import type { Oil, Recipe } from '../db/schema'
import { db, normalizeRecipeFromImport } from '../db/schema'
import { mergeAllOils, extractOilsFromRecipes } from './oilMerger'
import {
  validateFileSize,
  backupPayloadV2Schema,
  type ValidationResult,
} from './validation'

export interface BackupPayloadV2 {
  version: 2
  oils: Oil[]
  recipes: Recipe[]
}

export interface ImportResult {
  oilsCount: number
  recipesCount: number
}

/**
 * Export all data as a JSON backup file.
 */
export async function exportBackupJson(): Promise<string> {
  const [oils, recipes] = await Promise.all([
    db.oils.toArray(),
    db.recipes.toArray(),
  ])
  const payload: BackupPayloadV2 = { version: 2, oils, recipes }
  return JSON.stringify(payload, null, 2)
}

/**
 * Step 1: Validate file and return preview data without importing.
 */
export async function previewImport(
  text: string,
): Promise<ValidationResult<{ oils: Oil[]; recipes: Recipe[] }>> {
  // Check file size
  const sizeCheck = validateFileSize(text)
  if (!sizeCheck.valid) {
    return { valid: false, error: sizeCheck.error }
  }

  // Parse JSON
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { valid: false, error: 'Invalid JSON format.' }
  }

  // Validate with Zod schema
  const result = backupPayloadV2Schema.safeParse(parsed)
  if (!result.success) {
    return {
      valid: false,
      error: `Invalid backup format: ${result.error.issues.map(i => i.message).join('; ')}`,
    }
  }

  return {
    valid: true,
    data: {
      oils: result.data.oils,
      recipes: result.data.recipes,
    },
  }
}

/**
 * Step 2: Execute the import with validated data.
 */
export async function executeImport(
  previewData: { oils: Oil[]; recipes: Recipe[] },
): Promise<ImportResult> {
  // Extract oils from recipes
  const recipeOils = extractOilsFromRecipes(previewData.recipes)

  // Get existing oils from database
  const existing = await db.oils.toArray()

  // Merge all oil sources
  const mergedOils = mergeAllOils(existing, previewData.oils, recipeOils)

  // Write to database in a transaction
  await db.transaction('rw', db.oils, db.recipes, async () => {
    await db.oils.clear()
    await db.recipes.clear()
    await db.oils.bulkPut(mergedOils)
    await db.recipes.bulkPut(previewData.recipes)
  })

  return {
    oilsCount: mergedOils.length,
    recipesCount: previewData.recipes.length,
  }
}

/**
 * Legacy import function for V1 format (backwards compatibility).
 */
export async function importBackupJsonLegacy(
  text: string,
): Promise<ImportResult> {
  const parsed = JSON.parse(text) as {
    version?: number
    oils: Record<string, unknown>[]
    recipes: Record<string, unknown>[]
  }

  if (!parsed || !Array.isArray(parsed.recipes)) {
    throw new Error('Invalid backup: expected recipes array')
  }

  // Normalize recipes (handles v1 → v2 migration)
  const recipes = (parsed.recipes as unknown[]).map((raw) =>
    normalizeRecipeFromImport(raw),
  )

  // Extract oils from recipes
  const recipeOils = extractOilsFromRecipes(recipes)

  // Get existing oils from database
  const existing = await db.oils.toArray()

  // Get file oils (may be legacy format)
  const fileOils = Array.isArray(parsed.oils) ? parsed.oils : []

  // Merge all oil sources (with legacy normalization)
  const mergedByName = new Map<string, Oil>()

  for (const o of existing) {
    mergedByName.set(o.name.toLowerCase(), o)
  }

  for (const raw of fileOils) {
    const name = String((raw as { name?: string }).name ?? '').trim()
    if (!name) continue
    const k = name.toLowerCase()
    const lastUsedMaxPercent =
      typeof (raw as { maxPercent?: number }).maxPercent === 'number'
        ? (raw as { maxPercent: number }).maxPercent * 100
        : null
    const incoming: Oil = { name, lastUsedMaxPercent }
    const prev = mergedByName.get(k)
    mergedByName.set(
      k,
      prev
        ? {
            name: prev.name,
            lastUsedMaxPercent:
              prev.lastUsedMaxPercent != null && incoming.lastUsedMaxPercent != null
                ? Math.min(prev.lastUsedMaxPercent, incoming.lastUsedMaxPercent)
                : (prev.lastUsedMaxPercent ?? incoming.lastUsedMaxPercent ?? null),
          }
        : incoming,
    )
  }

  for (const o of recipeOils) {
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