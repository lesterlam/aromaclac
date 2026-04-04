import type { Oil } from '../db/schema'
import { MAX_NAME_LENGTH } from './validation'

/**
 * Normalize an oil name by trimming whitespace and enforcing length limits.
 */
function normalizeName(name: string): string {
  const trimmed = name.trim()
  // Enforce maximum length
  if (trimmed.length > MAX_NAME_LENGTH) {
    return trimmed.slice(0, MAX_NAME_LENGTH)
  }
  return trimmed
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
 * Only includes oils with valid, non-empty names.
 */
export function extractOilsFromRecipes(recipes: import('../db/schema').Recipe[]): Oil[] {
  const byName = new Map<string, Oil>()
  for (const recipe of recipes) {
    for (const cat of recipe.categories ?? []) {
      for (const line of cat.essentialOils ?? []) {
        const name = normalizeName(line.name)
        // Skip empty names
        if (!name) continue
        
        const oil: Oil = {
          name,
          lastUsedMaxPercent: line.maxPercentLimit ?? null,
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
 * Returns null for invalid entries (empty names, etc.)
 */
interface RawOil {
  name?: string
  maxPercent?: number
  lastUsedMaxPercent?: number | null
}

export function normalizeOil(raw: RawOil): Oil | null {
  // Handle null/undefined raw input
  if (!raw) return null
  
  const name = normalizeName(String(raw.name ?? ''))
  // Skip empty names
  if (!name) return null

  // Handle V2 format
  if ('lastUsedMaxPercent' in raw) {
    // Validate the percent value
    const percent = raw.lastUsedMaxPercent
    if (percent !== null && (typeof percent !== 'number' || Number.isNaN(percent))) {
      return { name, lastUsedMaxPercent: null }
    }
    // Percent should be between 0 and 100
    if (percent !== null && (percent < 0 || percent > 100)) {
      return { name, lastUsedMaxPercent: null }
    }
    return {
      name,
      lastUsedMaxPercent: percent ?? null,
    }
  }

  // Handle legacy V1 format (maxPercent as decimal, e.g., 0.01 = 1%)
  if (typeof raw.maxPercent === 'number' && !Number.isNaN(raw.maxPercent)) {
    // V1 stores as decimal (0.01 = 1%), convert to percentage
    // Clamp to reasonable range
    const converted = raw.maxPercent * 100
    if (converted >= 0 && converted <= 100) {
      return {
        name,
        lastUsedMaxPercent: converted,
      }
    }
    return { name, lastUsedMaxPercent: null }
  }

  return { name, lastUsedMaxPercent: null }
}

/**
 * Merge existing oils with imported oils (from file and recipes).
 * Applies validation and deduplication.
 */
export function mergeAllOils(
  existing: Oil[],
  fileOils: RawOil[],
  recipeOils: Oil[],
): Oil[] {
  const mergedByName = new Map<string, Oil>()

  // Start with existing oils (already validated)
  for (const o of existing) {
    if (o.name) {
      mergedByName.set(o.name.toLowerCase(), o)
    }
  }

  // Merge file oils (with validation)
  for (const raw of fileOils) {
    const oil = normalizeOil(raw)
    if (!oil) continue
    const k = oil.name.toLowerCase()
    const prev = mergedByName.get(k)
    mergedByName.set(k, prev ? mergeOils(prev, oil) : oil)
  }

  // Merge recipe oils (already validated)
  for (const o of recipeOils) {
    if (!o.name) continue
    const k = o.name.toLowerCase()
    const prev = mergedByName.get(k)
    mergedByName.set(k, prev ? mergeOils(prev, o) : o)
  }

  return [...mergedByName.values()]
}