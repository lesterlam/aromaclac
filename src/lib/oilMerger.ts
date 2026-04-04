import type { Oil } from '../db/schema'

/**
 * Normalize an oil name by trimming whitespace.
 */
function normalizeName(name: string): string {
  return name.trim()
}

/**
 * Merge two oil entries, taking the lower max dilution percentage.
 */
export function mergeOils(a: Oil, b: Oil): Oil {
  const lastUsedMaxPercent =
    a.lastUsedMaxPercent != null && b.lastUsedMaxPercent != null
      ? Math.min(a.lastUsedMaxPercent, b.lastUsedMaxPercent)
      : (a.lastUsedMaxPercent ?? b.lastUsedMaxPercent ?? null)
  return {
    name: a.name,
    lastUsedMaxPercent,
  }
}

/**
 * Extract oils from recipes' essential oil lines.
 */
export function extractOilsFromRecipes(recipes: import('../db/schema').Recipe[]): Oil[] {
  const byName = new Map<string, Oil>()
  for (const recipe of recipes) {
    for (const cat of recipe.categories ?? []) {
      for (const line of cat.essentialOils ?? []) {
        const name = normalizeName(line.name)
        if (!name) continue
        const oil: Oil = {
          name,
          lastUsedMaxPercent: line.maxPercentLimit,
        }
        const k = name.toLowerCase()
        const prev = byName.get(k)
        byName.set(k, prev ? mergeOils(prev, oil) : oil)
      }
    }
  }
  return [...byName.values()]
}

/**
 * Convert raw oil data to Oil type, handling legacy format.
 */
interface RawOil {
  name?: string
  maxPercent?: number
  lastUsedMaxPercent?: number | null
}

export function normalizeOil(raw: RawOil): Oil | null {
  const name = normalizeName(String(raw.name ?? ''))
  if (!name) return null

  // Handle V2 format
  if ('lastUsedMaxPercent' in raw) {
    return {
      name,
      lastUsedMaxPercent: raw.lastUsedMaxPercent ?? null,
    }
  }

  // Handle legacy V1 format (maxPercent as decimal, e.g., 0.01 = 1%)
  if (typeof raw.maxPercent === 'number') {
    return {
      name,
      lastUsedMaxPercent: raw.maxPercent * 100,
    }
  }

  return { name, lastUsedMaxPercent: null }
}

/**
 * Merge existing oils with imported oils (from file and recipes).
 */
export function mergeAllOils(
  existing: Oil[],
  fileOils: RawOil[],
  recipeOils: Oil[],
): Oil[] {
  const mergedByName = new Map<string, Oil>()

  // Start with existing oils
  for (const o of existing) {
    mergedByName.set(o.name.toLowerCase(), o)
  }

  // Merge file oils
  for (const raw of fileOils) {
    const oil = normalizeOil(raw)
    if (!oil) continue
    const k = oil.name.toLowerCase()
    const prev = mergedByName.get(k)
    mergedByName.set(k, prev ? mergeOils(prev, oil) : oil)
  }

  // Merge recipe oils
  for (const o of recipeOils) {
    const k = o.name.toLowerCase()
    const prev = mergedByName.get(k)
    mergedByName.set(k, prev ? mergeOils(prev, o) : o)
  }

  return [...mergedByName.values()]
}