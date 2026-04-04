import type { Oil, Recipe } from '../db/schema'
import { db, normalizeRecipeFromImport } from '../db/schema'
import { mergeAllOils, extractOilsFromRecipes } from './oilMerger'

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

export async function exportBackupJson(): Promise<string> {
  const [oils, recipes] = await Promise.all([
    db.oils.toArray(),
    db.recipes.toArray(),
  ])
  const payload: BackupPayloadV2 = { version: 2, oils, recipes }
  return JSON.stringify(payload, null, 2)
}

/**
 * Import recipes and oils from a JSON backup file.
 * Merges with existing data, preferring lower dilution percentages.
 */
export async function importBackupJson(
  text: string,
): Promise<{ oilsCount: number; recipesCount: number }> {
  const parsed = JSON.parse(text) as Partial<BackupPayloadV2> &
    Partial<BackupPayloadV1>

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

  // Merge all oil sources
  const mergedOils = mergeAllOils(existing, fileOils, recipeOils)

  // Write to database in a transaction
  await db.transaction('rw', db.oils, db.recipes, async () => {
    await db.oils.clear()
    await db.recipes.clear()
    await db.oils.bulkPut(mergedOils)
    await db.recipes.bulkPut(recipes)
  })

  return { oilsCount: mergedOils.length, recipesCount: recipes.length }
}