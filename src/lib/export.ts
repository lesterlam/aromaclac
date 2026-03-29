import Papa from 'papaparse'
import type { Oil, Recipe } from '../db/schema'
import { db, normalizeRecipeFromImport } from '../db/schema'
import {
  calculateBaseVolumes,
  flattenEssentialOils,
  getSafetyStatus,
  roundMlForDisplay,
} from '../logic/aroma'

export interface BackupPayloadV2 {
  version: 2
  oils: Oil[]
  recipes: Recipe[]
}

/** Legacy export shape (pre–schema v2). */
interface BackupPayloadV1 {
  version?: number
  oils: Record<string, unknown>[]
  recipes: Record<string, unknown>[]
}

function normName(name: string): string {
  return name.trim()
}

function mergeOilLibrary(a: Oil, b: Oil): Oil {
  const lastUsedMaxPercent =
    a.lastUsedMaxPercent != null && b.lastUsedMaxPercent != null
      ? Math.min(a.lastUsedMaxPercent, b.lastUsedMaxPercent)
      : (a.lastUsedMaxPercent ?? b.lastUsedMaxPercent ?? null)
  return {
    name: a.name,
    lastUsedMaxPercent,
  }
}

export async function exportBackupJson(): Promise<string> {
  const [oils, recipes] = await Promise.all([
    db.oils.toArray(),
    db.recipes.toArray(),
  ])
  const payload: BackupPayloadV2 = { version: 2, oils, recipes }
  return JSON.stringify(payload, null, 2)
}

/** PRD §7.1: sync library from all essential oils in imported recipes. */
function syncLibraryFromImportedRecipes(recipes: Recipe[]): Oil[] {
  const byName = new Map<string, Oil>()
  for (const recipe of recipes) {
    for (const cat of recipe.categories ?? []) {
      for (const line of cat.essentialOils ?? []) {
        const name = normName(line.name)
        if (!name) continue
        const oil: Oil = {
          name,
          lastUsedMaxPercent: line.maxPercentLimit,
        }
        const k = name.toLowerCase()
        const prev = byName.get(k)
        byName.set(k, prev ? mergeOilLibrary(prev, oil) : oil)
      }
    }
  }
  return [...byName.values()]
}

export async function importBackupJson(
  text: string,
): Promise<{ oilsCount: number; recipesCount: number }> {
  const parsed = JSON.parse(text) as Partial<BackupPayloadV2> &
    Partial<BackupPayloadV1>
  if (!parsed || !Array.isArray(parsed.recipes)) {
    throw new Error('Invalid backup: expected recipes array')
  }

  const recipes = (parsed.recipes as unknown[]).map((raw) =>
    normalizeRecipeFromImport(raw),
  )

  const fromFileOils = Array.isArray(parsed.oils) ? parsed.oils : []
  const mergedByName = new Map<string, Oil>()

  const existing = await db.oils.toArray()
  for (const o of existing) {
    mergedByName.set(o.name.toLowerCase(), o)
  }

  for (const raw of fromFileOils) {
    const name = normName(String((raw as { name?: string }).name ?? ''))
    if (!name) continue
    const k = name.toLowerCase()
    const v2 = raw as Oil
    const incoming: Oil =
      'lastUsedMaxPercent' in raw
        ? {
            name,
            lastUsedMaxPercent:
              v2.lastUsedMaxPercent != null ? v2.lastUsedMaxPercent : null,
          }
        : {
            name,
            lastUsedMaxPercent:
              typeof (raw as { maxPercent?: number }).maxPercent === 'number'
                ? (raw as { maxPercent: number }).maxPercent * 100
                : null,
          }
    const prev = mergedByName.get(k)
    mergedByName.set(k, prev ? mergeOilLibrary(prev, incoming) : incoming)
  }

  for (const o of syncLibraryFromImportedRecipes(recipes)) {
    mergedByName.set(o.name.toLowerCase(), o)
  }

  const mergedOils = [...mergedByName.values()]

  await db.transaction('rw', db.oils, db.recipes, async () => {
    await db.oils.clear()
    await db.recipes.clear()
    await db.oils.bulkPut(mergedOils)
    await db.recipes.bulkPut(recipes)
  })

  return { oilsCount: mergedOils.length, recipesCount: recipes.length }
}

export function recipeToCsv(recipe: Recipe): string {
  const baseRows = calculateBaseVolumes(recipe.baseOils ?? [], recipe.targetVolumeML)
  const vbase = recipe.targetVolumeML

  const rows: {
    recipeName: string
    ingredient: string
    type: string
    amount: string
    percentOfBase: string
  }[] = []

  for (let i = 0; i < baseRows.length; i++) {
    const b = baseRows[i]
    const ml = roundMlForDisplay(b.calculatedML)
    rows.push({
      recipeName: recipe.title,
      ingredient: b.name || 'Base',
      type: 'Base',
      amount: `${ml.toFixed(2)} ml`,
      percentOfBase:
        vbase > 0 ? ((b.calculatedML / vbase) * 100).toFixed(2) : '0',
    })
  }

  for (const line of flattenEssentialOils(recipe)) {
    const st = getSafetyStatus(
      line.drops,
      line.maxPercentLimit,
      vbase,
    )
    rows.push({
      recipeName: recipe.title,
      ingredient: line.name,
      type: 'Essential',
      amount: `${line.drops} drops`,
      percentOfBase: st.currentPercentDisplay,
    })
  }

  return Papa.unparse(rows, { header: true })
}
