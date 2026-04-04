import { db } from '../db/schema'
import type { BaseOil, Oil, Recipe } from '../db/schema'

/**
 * Recipe Repository - Data Access Layer
 * Centralizes all database operations for recipes, oils, and base oils.
 */

// ============================================================================
// Recipe Operations
// ============================================================================

/**
 * Save a recipe to IndexedDB.
 */
export async function saveRecipe(recipe: Recipe): Promise<void> {
  await db.recipes.put(recipe)
}

/**
 * Delete a recipe by ID.
 */
export async function deleteRecipe(id: string): Promise<void> {
  await db.recipes.delete(id)
}

/**
 * Get a single recipe by ID.
 */
export async function getRecipe(id: string): Promise<Recipe | undefined> {
  return db.recipes.get(id)
}

/**
 * Get all recipes sorted by title.
 */
export async function getAllRecipes(): Promise<Recipe[]> {
  return db.recipes.orderBy('title').toArray()
}

/**
 * Get the first recipe from the database, or undefined if empty.
 */
export async function getFirstRecipe(): Promise<Recipe | undefined> {
  const recipes = await db.recipes.orderBy('title').toArray()
  return recipes[0]
}

// ============================================================================
// Oil Library Operations
// ============================================================================

/**
 * Sync essential oils from a recipe to the library.
 * Only saves oils with non-empty names.
 */
export async function syncOilsFromRecipe(recipe: Recipe): Promise<void> {
  for (const cat of recipe.categories) {
    for (const line of cat.essentialOils) {
      const name = line.name.trim()
      if (!name) continue
      await db.oils.put({
        name,
        lastUsedMaxPercent: line.maxPercentLimit,
      })
    }
  }
}

/**
 * Sync base oils from a recipe to the library.
 * Only saves oils with non-empty names.
 */
export async function syncBaseOilsFromRecipe(recipe: Recipe): Promise<void> {
  for (const base of recipe.baseOils) {
    const name = base.name.trim()
    if (!name) continue
    await db.baseOils.put({ name })
  }
}

/**
 * Save a recipe and sync all referenced oils to the library.
 */
export async function persistRecipe(recipe: Recipe): Promise<void> {
  await saveRecipe(recipe)
  await syncOilsFromRecipe(recipe)
  await syncBaseOilsFromRecipe(recipe)
}

/**
 * Delete an essential oil from the library.
 */
export async function deleteOil(name: string): Promise<void> {
  await db.oils.delete(name)
}

/**
 * Delete a base oil from the library.
 */
export async function deleteBaseOil(name: string): Promise<void> {
  await db.baseOils.delete(name)
}

/**
 * Get all essential oils sorted by name.
 */
export async function getAllOils(): Promise<Oil[]> {
  return db.oils.orderBy('name').toArray()
}

/**
 * Get all base oils sorted by name.
 */
export async function getAllBaseOils(): Promise<BaseOil[]> {
  return db.baseOils.orderBy('name').toArray()
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Persist current recipe and switch to another recipe by ID.
 * Also updates the last opened recipe preference.
 */
export async function flushAndSwitchRecipe(
  currentRecipe: Recipe,
  targetId: string,
): Promise<Recipe | undefined> {
  await persistRecipe(currentRecipe)
  const found = await getRecipe(targetId)
  if (found) {
    localStorage.setItem('aromacalc-last-recipe-id', targetId)
  }
  return found
}

/**
 * Persist current recipe and create a new blank recipe.
 * Clears the last opened recipe preference.
 */
export async function flushAndCreateNew(
  currentRecipe: Recipe,
): Promise<Recipe> {
  await persistRecipe(currentRecipe)
  localStorage.removeItem('aromacalc-last-recipe-id')
  return createNewRecipe()
}

/**
 * Delete a recipe and return the next recipe to select.
 * Returns the first remaining recipe, or a new blank recipe if none remain.
 */
export async function deleteAndSelectNext(
  deletedId: string,
): Promise<Recipe> {
  await deleteRecipe(deletedId)
  const remaining = await getAllRecipes()
  if (remaining.length > 0) {
    return remaining[0]
  }
  return createNewRecipe()
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new blank recipe with default values.
 */
export function createNewRecipe(): Recipe {
  return {
    id: crypto.randomUUID(),
    title: 'New Recipe',
    description: '',
    targetVolumeML: 50,
    baseOils: [{ name: '', ratio: 1 }],
    categories: [
      {
        id: crypto.randomUUID(),
        name: 'Category',
        essentialOils: [],
      },
    ],
  }
}

/**
 * Create a new essential oil line with defaults.
 */
export function createEssentialOilLine(
  name: string,
  maxPercentLimit: number | null = null,
): { id: string; name: string; drops: number; maxPercentLimit: number | null } {
  return {
    id: crypto.randomUUID(),
    name,
    drops: 1,
    maxPercentLimit,
  }
}

/**
 * Add an essential oil from the library to a recipe's first category.
 */
export function addOilToRecipe(
  recipe: Recipe,
  oil: Oil,
): Recipe {
  const cats = [...recipe.categories]
  if (cats.length === 0) {
    cats.push({
      id: crypto.randomUUID(),
      name: 'Default',
      essentialOils: [],
    })
  }
  const first = cats[0]
  cats[0] = {
    ...first,
    essentialOils: [
      ...first.essentialOils,
      createEssentialOilLine(oil.name, oil.lastUsedMaxPercent),
    ],
  }
  return { ...recipe, categories: cats }
}

/**
 * Add a base oil from the library to a recipe.
 * If there's an empty base oil row, replaces it; otherwise adds a new row.
 */
export function addBaseOilToRecipe(
  recipe: Recipe,
  oil: BaseOil,
): Recipe {
  const emptyIndex = recipe.baseOils.findIndex((b) => b.name === '')
  if (emptyIndex >= 0) {
    return {
      ...recipe,
      baseOils: recipe.baseOils.map((b, i) =>
        i === emptyIndex ? { name: oil.name, ratio: 1 } : b,
      ),
    }
  }
  return {
    ...recipe,
    baseOils: [
      ...recipe.baseOils,
      { name: oil.name, ratio: 1 },
    ],
  }
}