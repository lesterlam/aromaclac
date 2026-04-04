import { describe, it, expect } from 'vitest'
import {
  mergeOils,
  normalizeOil,
  extractOilsFromRecipes,
  mergeAllOils,
} from './oilMerger'
import type { Recipe } from '../db/schema'

describe('oilMerger', () => {
  describe('normalizeOil', () => {
    it('should handle V2 format with lastUsedMaxPercent', () => {
      const result = normalizeOil({ name: 'Tea Tree', lastUsedMaxPercent: 5 })
      expect(result).toEqual({ name: 'Tea Tree', lastUsedMaxPercent: 5 })
    })

    it('should handle V2 format with null lastUsedMaxPercent', () => {
      const result = normalizeOil({ name: 'Tea Tree', lastUsedMaxPercent: null })
      expect(result).toEqual({ name: 'Tea Tree', lastUsedMaxPercent: null })
    })

    it('should handle legacy V1 format with maxPercent as decimal', () => {
      const result = normalizeOil({ name: 'Lavender', maxPercent: 0.02 })
      expect(result).toEqual({ name: 'Lavender', lastUsedMaxPercent: 2 })
    })

    it('should handle legacy V1 format with maxPercent as integer decimal', () => {
      const result = normalizeOil({ name: 'Peppermint', maxPercent: 0.01 })
      expect(result).toEqual({ name: 'Peppermint', lastUsedMaxPercent: 1 })
    })

    it('should default to null when no percent data', () => {
      const result = normalizeOil({ name: 'Rose' })
      expect(result).toEqual({ name: 'Rose', lastUsedMaxPercent: null })
    })

    it('should return null for empty name', () => {
      const result = normalizeOil({ name: '' })
      expect(result).toBeNull()
    })

    it('should return null for whitespace-only names', () => {
      const result = normalizeOil({ name: '   ' })
      expect(result).toBeNull()
    })

    it('should return null for null raw input', () => {
      const result = normalizeOil(null as any)
      expect(result).toBeNull()
    })

    it('should return null for undefined raw input', () => {
      const result = normalizeOil(undefined as any)
      expect(result).toBeNull()
    })

    it('should trim whitespace from names', () => {
      const result = normalizeOil({ name: '  Lavender  ' })
      expect(result?.name).toBe('Lavender')
    })

    it('should truncate names exceeding max length', () => {
      const longName = 'A'.repeat(150)
      const result = normalizeOil({ name: longName })
      expect(result?.name.length).toBe(100)
    })

    it('should return null for invalid percent values', () => {
      const result = normalizeOil({ name: 'Tea Tree', lastUsedMaxPercent: NaN as any })
      expect(result).toEqual({ name: 'Tea Tree', lastUsedMaxPercent: null })
    })

    it('should return null for out-of-range percent values', () => {
      const result = normalizeOil({ name: 'Tea Tree', lastUsedMaxPercent: 150 })
      expect(result).toEqual({ name: 'Tea Tree', lastUsedMaxPercent: null })
    })

    it('should accept zero percent', () => {
      const result = normalizeOil({ name: 'Tea Tree', lastUsedMaxPercent: 0 })
      expect(result).toEqual({ name: 'Tea Tree', lastUsedMaxPercent: 0 })
    })
  })

  describe('mergeOils', () => {
    it('should take the lower maxPercent when both have values', () => {
      const a = { name: 'Lavender', lastUsedMaxPercent: 5 }
      const b = { name: 'Lavender', lastUsedMaxPercent: 3 }
      const result = mergeOils(a, b)
      expect(result.lastUsedMaxPercent).toBe(3)
    })

    it('should prefer the non-null value when one is null', () => {
      const a = { name: 'Lavender', lastUsedMaxPercent: 5 }
      const b = { name: 'Lavender', lastUsedMaxPercent: null }
      const result = mergeOils(a, b)
      expect(result.lastUsedMaxPercent).toBe(5)
    })

    it('should return null when both are null', () => {
      const a = { name: 'Lavender', lastUsedMaxPercent: null }
      const b = { name: 'Lavender', lastUsedMaxPercent: null }
      const result = mergeOils(a, b)
      expect(result.lastUsedMaxPercent).toBeNull()
    })

    it('should handle undefined lastUsedMaxPercent', () => {
      const a = { name: 'Lavender', lastUsedMaxPercent: 5 }
      const b = { name: 'Lavender' } as any
      const result = mergeOils(a, b)
      expect(result.lastUsedMaxPercent).toBe(5)
    })
  })

  describe('extractOilsFromRecipes', () => {
    it('should extract oils from recipe essential oils', () => {
      const recipes: Recipe[] = [
        {
          id: '1',
          title: 'Test',
          description: '',
          targetVolumeML: 50,
          baseOils: [],
          categories: [
            {
              id: 'c1',
              name: 'Category',
              essentialOils: [
                { id: 'e1', name: 'Lavender', drops: 5, maxPercentLimit: 2 },
                { id: 'e2', name: 'Tea Tree', drops: 3, maxPercentLimit: 1 },
              ],
            },
          ],
        },
      ]

      const result = extractOilsFromRecipes(recipes)
      expect(result).toHaveLength(2)
      expect(result).toContainEqual({ name: 'Lavender', lastUsedMaxPercent: 2 })
      expect(result).toContainEqual({ name: 'Tea Tree', lastUsedMaxPercent: 1 })
    })

    it('should merge oils with same name (case-insensitive)', () => {
      const recipes: Recipe[] = [
        {
          id: '1',
          title: 'Test',
          description: '',
          targetVolumeML: 50,
          baseOils: [],
          categories: [
            {
              id: 'c1',
              name: 'Category',
              essentialOils: [
                { id: 'e1', name: 'Lavender', drops: 5, maxPercentLimit: 5 },
                { id: 'e2', name: 'lavender', drops: 3, maxPercentLimit: 3 },
              ],
            },
          ],
        },
      ]

      const result = extractOilsFromRecipes(recipes)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Lavender')
      expect(result[0].lastUsedMaxPercent).toBe(3) // Takes lower value
    })

    it('should skip oils with empty names', () => {
      const recipes: Recipe[] = [
        {
          id: '1',
          title: 'Test',
          description: '',
          targetVolumeML: 50,
          baseOils: [],
          categories: [
            {
              id: 'c1',
              name: 'Category',
              essentialOils: [
                { id: 'e1', name: '', drops: 5, maxPercentLimit: null },
                { id: 'e2', name: '   ', drops: 3, maxPercentLimit: null },
              ],
            },
          ],
        },
      ]

      const result = extractOilsFromRecipes(recipes)
      expect(result).toHaveLength(0)
    })

    it('should handle multiple recipes', () => {
      const recipes: Recipe[] = [
        {
          id: '1',
          title: 'Test1',
          description: '',
          targetVolumeML: 50,
          baseOils: [],
          categories: [
            {
              id: 'c1',
              name: 'Category',
              essentialOils: [
                { id: 'e1', name: 'Lavender', drops: 5, maxPercentLimit: 2 },
              ],
            },
          ],
        },
        {
          id: '2',
          title: 'Test2',
          description: '',
          targetVolumeML: 50,
          baseOils: [],
          categories: [
            {
              id: 'c2',
              name: 'Category',
              essentialOils: [
                { id: 'e2', name: 'Peppermint', drops: 3, maxPercentLimit: 1 },
              ],
            },
          ],
        },
      ]

      const result = extractOilsFromRecipes(recipes)
      expect(result).toHaveLength(2)
      expect(result).toContainEqual({ name: 'Lavender', lastUsedMaxPercent: 2 })
      expect(result).toContainEqual({ name: 'Peppermint', lastUsedMaxPercent: 1 })
    })

    it('should return empty array for empty recipes', () => {
      const result = extractOilsFromRecipes([])
      expect(result).toHaveLength(0)
    })

    it('should return empty array for recipes with no essential oils', () => {
      const recipes: Recipe[] = [
        {
          id: '1',
          title: 'Test',
          description: '',
          targetVolumeML: 50,
          baseOils: [],
          categories: [],
        },
      ]

      const result = extractOilsFromRecipes(recipes)
      expect(result).toHaveLength(0)
    })
  })

  describe('mergeAllOils', () => {
    it('should merge existing, file, and recipe oils', () => {
      const existing: any[] = [{ name: 'Lavender', lastUsedMaxPercent: 5 }]
      const fileOils: any[] = [{ name: 'Tea Tree', lastUsedMaxPercent: 2 }]
      const recipeOils: any[] = [
        { name: 'Eucalyptus', lastUsedMaxPercent: 1 },
      ]

      const result = mergeAllOils(existing, fileOils, recipeOils)
      expect(result).toHaveLength(3)
      expect(result.map((o) => o.name)).toContain('Lavender')
      expect(result.map((o) => o.name)).toContain('Tea Tree')
      expect(result.map((o) => o.name)).toContain('Eucalyptus')
    })

    it('should handle conflicting oils between sources', () => {
      const existing: any[] = [{ name: 'Lavender', lastUsedMaxPercent: 5 }]
      const fileOils: any[] = [{ name: 'lavender', lastUsedMaxPercent: 3 }]
      const recipeOils: any[] = []

      const result = mergeAllOils(existing, fileOils, recipeOils)
      expect(result).toHaveLength(1)
      expect(result[0].lastUsedMaxPercent).toBe(3) // Takes lower
    })

    it('should prefer lower dilution when merging', () => {
      const existing: any[] = [{ name: 'Lavender', lastUsedMaxPercent: 5 }]
      const fileOils: any[] = [{ name: 'Lavender', lastUsedMaxPercent: 2 }]
      const recipeOils: any[] = [{ name: 'LAVENDER', lastUsedMaxPercent: 4 }]

      const result = mergeAllOils(existing, fileOils, recipeOils)
      expect(result).toHaveLength(1)
      expect(result[0].lastUsedMaxPercent).toBe(2) // Takes lowest
    })

    it('should handle empty inputs', () => {
      const result = mergeAllOils([], [], [])
      expect(result).toHaveLength(0)
    })
  })
})