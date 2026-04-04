import { describe, it, expect } from 'vitest'
import {
  createNewRecipe,
  createEssentialOilLine,
  addOilToRecipe,
  addBaseOilToRecipe,
} from './recipeRepository'
import type { Recipe, Oil, BaseOil } from '../db/schema'

describe('recipeRepository', () => {
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
        essentialOils: [],
      },
    ],
    ...overrides,
  })

  describe('createNewRecipe', () => {
    it('should create a recipe with default values', () => {
      const recipe = createNewRecipe()

      expect(recipe.id).toBeDefined()
      expect(recipe.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
      expect(recipe.title).toBe('New Recipe')
      expect(recipe.description).toBe('')
      expect(recipe.targetVolumeML).toBe(50)
    })

    it('should create a recipe with default base oil', () => {
      const recipe = createNewRecipe()

      expect(recipe.baseOils).toHaveLength(1)
      expect(recipe.baseOils[0]).toEqual({ name: '', ratio: 1 })
    })

    it('should create a recipe with default category', () => {
      const recipe = createNewRecipe()

      expect(recipe.categories).toHaveLength(1)
      expect(recipe.categories[0].name).toBe('Category')
      expect(recipe.categories[0].essentialOils).toHaveLength(0)
    })

    it('should generate unique IDs each time', () => {
      const recipe1 = createNewRecipe()
      const recipe2 = createNewRecipe()

      expect(recipe1.id).not.toBe(recipe2.id)
      expect(recipe1.categories[0].id).not.toBe(recipe2.categories[0].id)
    })
  })

  describe('createEssentialOilLine', () => {
    it('should create line with defaults', () => {
      const line = createEssentialOilLine('Lavender')

      expect(line.id).toBeDefined()
      expect(line.name).toBe('Lavender')
      expect(line.drops).toBe(1)
      expect(line.maxPercentLimit).toBeNull()
    })

    it('should create line with custom maxPercentLimit', () => {
      const line = createEssentialOilLine('Tea Tree', 5)

      expect(line.name).toBe('Tea Tree')
      expect(line.maxPercentLimit).toBe(5)
    })

    it('should create line with null maxPercentLimit', () => {
      const line = createEssentialOilLine('Rose', null)

      expect(line.maxPercentLimit).toBeNull()
    })

    it('should generate unique IDs', () => {
      const line1 = createEssentialOilLine('Lavender')
      const line2 = createEssentialOilLine('Lavender')

      expect(line1.id).not.toBe(line2.id)
    })
  })

  describe('addOilToRecipe', () => {
    it('should add oil to first category', () => {
      const recipe = createMockRecipe()
      const oil: Oil = { name: 'Lavender', lastUsedMaxPercent: 2 }

      const result = addOilToRecipe(recipe, oil)

      expect(result.categories[0].essentialOils).toHaveLength(1)
      expect(result.categories[0].essentialOils[0].name).toBe('Lavender')
      expect(result.categories[0].essentialOils[0].drops).toBe(1)
      expect(result.categories[0].essentialOils[0].maxPercentLimit).toBe(2)
    })

    it('should append to existing oils in category', () => {
      const recipe = createMockRecipe({
        categories: [
          {
            id: 'c1',
            name: 'Category',
            essentialOils: [
              { id: 'e1', name: 'Tea Tree', drops: 3, maxPercentLimit: 1 },
            ],
          },
        ],
      })
      const oil: Oil = { name: 'Lavender', lastUsedMaxPercent: 2 }

      const result = addOilToRecipe(recipe, oil)

      expect(result.categories[0].essentialOils).toHaveLength(2)
      expect(result.categories[0].essentialOils[1].name).toBe('Lavender')
    })

    it('should create default category if recipe has none', () => {
      const recipe = createMockRecipe({ categories: [] })
      const oil: Oil = { name: 'Lavender', lastUsedMaxPercent: 2 }

      const result = addOilToRecipe(recipe, oil)

      expect(result.categories).toHaveLength(1)
      expect(result.categories[0].name).toBe('Default')
      expect(result.categories[0].essentialOils).toHaveLength(1)
    })

    it('should not mutate original recipe', () => {
      const recipe = createMockRecipe()
      const oil: Oil = { name: 'Lavender', lastUsedMaxPercent: 2 }

      addOilToRecipe(recipe, oil)

      expect(recipe.categories[0].essentialOils).toHaveLength(0)
    })
  })

  describe('addBaseOilToRecipe', () => {
    it('should add base oil to recipe', () => {
      const recipe = createMockRecipe()
      const oil: BaseOil = { name: 'Almond' }

      const result = addBaseOilToRecipe(recipe, oil)

      expect(result.baseOils).toHaveLength(2)
      expect(result.baseOils[1]).toEqual({ name: 'Almond', ratio: 1 })
    })

    it('should replace empty base oil row if present', () => {
      const recipe = createMockRecipe({
        baseOils: [{ name: '', ratio: 1 }, { name: 'Jojoba', ratio: 1 }],
      })
      const oil: BaseOil = { name: 'Almond' }

      const result = addBaseOilToRecipe(recipe, oil)

      expect(result.baseOils).toHaveLength(2)
      expect(result.baseOils[0].name).toBe('Almond')
      expect(result.baseOils[0].ratio).toBe(1)
    })

    it('should prefer replacing empty row over adding new', () => {
      const recipe = createMockRecipe({
        baseOils: [{ name: '', ratio: 1 }],
      })
      const oil: BaseOil = { name: 'Almond' }

      const result = addBaseOilToRecipe(recipe, oil)

      expect(result.baseOils).toHaveLength(1)
      expect(result.baseOils[0].name).toBe('Almond')
    })

    it('should not mutate original recipe', () => {
      const recipe = createMockRecipe()
      const oil: BaseOil = { name: 'Almond' }

      addBaseOilToRecipe(recipe, oil)

      expect(recipe.baseOils).toHaveLength(1)
      expect(recipe.baseOils[0].name).toBe('Jojoba')
    })
  })
})