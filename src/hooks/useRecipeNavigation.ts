import { useEffect, useRef } from 'react'
import type { Recipe } from '../db/schema'

const LAST_RECIPE_ID_KEY = 'aromacalc-last-recipe-id'

/**
 * Manages recipe hydration from IndexedDB and last opened recipe tracking.
 * 
 * @param recipesFromDb - List of recipes loaded from the database
 * @param initialRecipe - The initial/new recipe state  
 * @param onRecipeChange - Callback to update the current recipe
 * @returns recipeInDb boolean indicating if current recipe exists in DB
 */
export function useRecipeNavigation(
  recipesFromDb: Recipe[],
  initialRecipe: Recipe,
  onRecipeChange: (recipe: Recipe) => void,
): boolean {
  const hydratedFromDb = useRef(false)
  const currentRecipeRef = useRef(initialRecipe)

  // Load the last opened recipe when IndexedDB data is available
  useEffect(() => {
    if (!recipesFromDb || hydratedFromDb.current) return
    hydratedFromDb.current = true

    const lastId = localStorage.getItem(LAST_RECIPE_ID_KEY)
    if (lastId) {
      const lastRecipe = recipesFromDb.find((r) => r.id === lastId)
      if (lastRecipe) {
        currentRecipeRef.current = lastRecipe
        onRecipeChange(lastRecipe)
        return
      }
    }

    // Fall back to first recipe
    if (recipesFromDb.length > 0) {
      currentRecipeRef.current = recipesFromDb[0]
      onRecipeChange(recipesFromDb[0])
    }
  }, [recipesFromDb, onRecipeChange])

  // Save last opened recipe ID when recipe changes
  useEffect(() => {
    currentRecipeRef.current = initialRecipe
    const existsInDb = recipesFromDb.some((r) => r.id === initialRecipe.id)
    if (existsInDb) {
      localStorage.setItem(LAST_RECIPE_ID_KEY, initialRecipe.id)
    }
  }, [initialRecipe.id, recipesFromDb])

  return recipesFromDb.some((r) => r.id === initialRecipe.id)
}