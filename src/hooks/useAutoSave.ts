import { useEffect, useRef } from 'react'
import type { Recipe } from '../db/schema'

/**
 * Auto-save hook with debounced persistence.
 * 
 * @param recipe - The recipe to save
 * @param onSave - Async function to perform the save operation
 * @param delay - Debounce delay in ms (default: 400)
 */
export function useAutoSave(
  recipe: Recipe,
  onSave: (r: Recipe) => Promise<void>,
  delay = 400,
): void {
  const persistReady = useRef(false)

  useEffect(() => {
    // Skip first render
    if (!persistReady.current) {
      persistReady.current = true
      return
    }

    const t = window.setTimeout(() => {
      void onSave(recipe)
    }, delay)

    return () => window.clearTimeout(t)
  }, [recipe, onSave, delay])
}