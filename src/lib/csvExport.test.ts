import { describe, it, expect } from 'vitest'
import { buildBaseOilRows, buildEssentialOilRows, recipeToCsv } from './csvExport'
import type { Recipe } from '../db/schema'

describe('csvExport', () => {
  const createMockRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
    id: '1',
    title: 'Test Recipe',
    description: '',
    targetVolumeML: 50,
    baseOils: [{ name: 'Jojoba', ratio: 1 }],
    categories: [
      {
        id: 'c1',
        name: 'Category',
        essentialOils: [
          { id: 'e1', name: 'Lavender', drops: 10, maxPercentLimit: 2 },
        ],
      },
    ],
    ...overrides,
  })

  describe('buildBaseOilRows', () => {
    it('should build rows for base oils', () => {
      const recipe = createMockRecipe({
        targetVolumeML: 100,
        baseOils: [
          { name: 'Jojoba', ratio: 2 },
          { name: 'Almond', ratio: 1 },
        ],
      })

      const rows = buildBaseOilRows(recipe)
      expect(rows).toHaveLength(2)
      expect(rows[0].type).toBe('Base')
      expect(rows[0].recipeName).toBe('Test Recipe')
    })

    it('should calculate proportional volumes based on ratios', () => {
      const recipe = createMockRecipe({
        targetVolumeML: 30,
        baseOils: [
          { name: 'Jojoba', ratio: 2 },
          { name: 'Almond', ratio: 1 },
        ],
      })

      const rows = buildBaseOilRows(recipe)
      // 2:1 ratio, total 30ml
      // Jojoba: 20ml (2/3), Almond: 10ml (1/3)
      const jojobaRow = rows.find((r) => r.ingredient === 'Jojoba')
      const almondRow = rows.find((r) => r.ingredient === 'Almond')

      expect(jojobaRow?.amount).toBe('20.00 ml')
      expect(almondRow?.amount).toBe('10.00 ml')
    })

    it('should use "Base" as ingredient for empty name', () => {
      const recipe = createMockRecipe({
        baseOils: [{ name: '', ratio: 1 }],
      })

      const rows = buildBaseOilRows(recipe)
      expect(rows[0].ingredient).toBe('Base')
    })

    it('should calculate percent of base correctly', () => {
      const recipe = createMockRecipe({
        targetVolumeML: 100,
        baseOils: [{ name: 'Jojoba', ratio: 1 }],
      })

      const rows = buildBaseOilRows(recipe)
      expect(rows[0].percentOfBase).toBe('100.00')
    })

    it('should handle zero target volume', () => {
      const recipe = createMockRecipe({
        targetVolumeML: 0,
        baseOils: [{ name: 'Jojoba', ratio: 1 }],
      })

      const rows = buildBaseOilRows(recipe)
      expect(rows[0].percentOfBase).toBe('0')
      expect(rows[0].amount).toBe('0.00 ml')
    })

    it('should handle empty base oils array', () => {
      const recipe = createMockRecipe({
        baseOils: [],
      })

      const rows = buildBaseOilRows(recipe)
      expect(rows).toHaveLength(0)
    })
  })

  describe('buildEssentialOilRows', () => {
    it('should build rows for essential oils', () => {
      const recipe = createMockRecipe()

      const rows = buildEssentialOilRows(recipe)
      expect(rows).toHaveLength(1)
      expect(rows[0].type).toBe('Essential')
      expect(rows[0].ingredient).toBe('Lavender')
      expect(rows[0].amount).toBe('10 drops')
    })

    it('should include safety percent in percentOfBase', () => {
      const recipe = createMockRecipe({
        targetVolumeML: 50,
        categories: [
          {
            id: 'c1',
            name: 'Category',
            essentialOils: [
              { id: 'e1', name: 'Lavender', drops: 10, maxPercentLimit: 2 },
            ],
          },
        ],
      })

      const rows = buildEssentialOilRows(recipe)
      // 10 drops * 0.05ml = 0.5ml
      // 0.5ml / 50ml * 100 = 1%
      expect(rows[0].percentOfBase).toBe('1.00')
    })

    it('should handle multiple categories', () => {
      const recipe = createMockRecipe({
        categories: [
          {
            id: 'c1',
            name: 'Citrus',
            essentialOils: [
              { id: 'e1', name: 'Lemon', drops: 5, maxPercentLimit: null },
            ],
          },
          {
            id: 'c2',
            name: 'Floral',
            essentialOils: [
              { id: 'e2', name: 'Rose', drops: 2, maxPercentLimit: null },
            ],
          },
        ],
      })

      const rows = buildEssentialOilRows(recipe)
      expect(rows).toHaveLength(2)
      expect(rows.map((r) => r.ingredient)).toContain('Lemon')
      expect(rows.map((r) => r.ingredient)).toContain('Rose')
    })

    it('should handle empty categories', () => {
      const recipe = createMockRecipe({
        categories: [],
      })

      const rows = buildEssentialOilRows(recipe)
      expect(rows).toHaveLength(0)
    })
  })

  describe('recipeToCsv', () => {
    it('should produce valid CSV with header', () => {
      const recipe = createMockRecipe()

      const csv = recipeToCsv(recipe)
      const lines = csv.split('\n')

      // Check that header contains expected columns (may have trailing newline)
      expect(lines[0]).toContain('recipeName')
      expect(lines[0]).toContain('ingredient')
      expect(lines[0]).toContain('type')
      expect(lines[0]).toContain('amount')
      expect(lines[0]).toContain('percentOfBase')
      expect(lines.length).toBeGreaterThan(1)
    })

    it('should include both base and essential oil rows', () => {
      const recipe = createMockRecipe()

      const csv = recipeToCsv(recipe)
      expect(csv).toContain('Base')
      expect(csv).toContain('Essential')
      expect(csv).toContain('Jojoba')
      expect(csv).toContain('Lavender')
    })

    it('should handle empty recipe', () => {
      const recipe = createMockRecipe({
        baseOils: [],
        categories: [],
      })

      const csv = recipeToCsv(recipe)
      const lines = csv.split('\n')
      expect(lines).toHaveLength(1) // Only header
    })

    it('should use recipe title for all rows', () => {
      const recipe = createMockRecipe({
        title: 'My Custom Recipe',
      })

      const csv = recipeToCsv(recipe)
      expect(csv).toContain('My Custom Recipe')
    })
  })
})