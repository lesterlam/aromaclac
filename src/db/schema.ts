import Dexie, { type Table } from 'dexie'

/**
 * Learned library: name is unique. lastUsedMaxPercent is % of base (e.g. 1 = 1%), or null.
 */
export interface Oil {
  name: string
  lastUsedMaxPercent: number | null
}

/**
 * Base oil library: name is unique.
 */
export interface BaseOil {
  name: string
}

export interface BaseOilRow {
  name: string
  ratio: number
}

export interface EssentialOilLine {
  id: string
  name: string
  drops: number
  /** Max allowed % of base volume (e.g. 1 = 1%), or null for no limit. */
  maxPercentLimit: number | null
}

export interface RecipeCategory {
  id: string
  name: string
  essentialOils: EssentialOilLine[]
}

export interface Recipe {
  id: string
  title: string
  description: string
  /** Target total volume in ml for the recipe base oils. */
  targetVolumeML: number
  baseOils: BaseOilRow[]
  categories: RecipeCategory[]
}

function newLineId(): string {
  return crypto.randomUUID()
}

export function migrateRecipeV1ToV2(r: Record<string, unknown>): Recipe {
  const targetVol =
    typeof r.targetVolume === 'number' && !Number.isNaN(r.targetVolume)
      ? r.targetVolume
      : 50
  const oldBases = (r.baseOils as { name?: string; ratio?: number }[]) ?? []
  const baseOils: BaseOilRow[] =
    oldBases.length > 0
      ? oldBases.map((b) => ({
          name: b.name ?? '',
          ratio: typeof b.ratio === 'number' ? b.ratio : 1,
        }))
      : [
          {
            name: 'Jojoba',
            ratio: 1,
          },
        ]

  const oldEo =
    (r.essentialOils as { name?: string; drops?: number }[]) ?? []
  const essentialOils: EssentialOilLine[] = oldEo.map((e) => ({
    id: newLineId(),
    name: e.name ?? '',
    drops: typeof e.drops === 'number' ? e.drops : 0,
    maxPercentLimit: null,
  }))

  return {
    id: typeof r.id === 'string' ? r.id : crypto.randomUUID(),
    title: typeof r.title === 'string' ? r.title : 'New Recipe',
    description: '',
    targetVolumeML: targetVol,
    baseOils,
    categories: [
      {
        id: crypto.randomUUID(),
        name: 'Default',
        essentialOils,
      },
    ],
  }
}

export class AromaCalcDB extends Dexie {
  oils!: Table<Oil, string>
  baseOils!: Table<BaseOil, string>
  recipes!: Table<Recipe, string>

  constructor() {
    super('AromaCalc')
    this.version(1).stores({
      oils: 'id, name',
      recipes: 'id, title',
    })
    this.version(2)
      .stores({
        oils: 'name',
        recipes: 'id, title',
      })
      .upgrade(async (tx) => {
        const oilsTbl = tx.table('oils')
        const recipesTbl = tx.table('recipes')
        const oldOils = (await oilsTbl.toArray()) as Record<string, unknown>[]
        await oilsTbl.clear()
        for (const o of oldOils) {
          const name = String(o.name ?? '').trim()
          if (!name) continue
          const frac = o.maxPercent
          const lastUsedMaxPercent =
            typeof frac === 'number' && frac > 0 ? frac * 100 : null
          await oilsTbl.put({
            name,
            lastUsedMaxPercent,
          } as Oil)
        }
        const oldRecipes = (await recipesTbl.toArray()) as Record<
          string,
          unknown
        >[]
        await recipesTbl.clear()
        for (const r of oldRecipes) {
          await recipesTbl.put(migrateRecipeV1ToV2(r))
        }
      })
    this.version(3)
      .stores({
        oils: 'name',
        baseOils: 'name',
        recipes: 'id, title',
      })
  }
}

export const db = new AromaCalcDB()

/** Normalize JSON import: v2 shape or legacy v1 recipe. */
export function normalizeRecipeFromImport(raw: unknown): Recipe {
  const r = raw as Record<string, unknown>
  if (Array.isArray(r.categories) && Array.isArray(r.baseOils)) {
    const targetVol =
      typeof r.targetVolumeML === 'number' && r.targetVolumeML > 0
        ? r.targetVolumeML
        : typeof r.targetVolume === 'number' && r.targetVolume > 0
          ? r.targetVolume
          : 50
    const recipe: Recipe = {
      id: typeof r.id === 'string' ? r.id : crypto.randomUUID(),
      title: typeof r.title === 'string' ? r.title : 'New Recipe',
      description: typeof r.description === 'string' ? r.description : '',
      targetVolumeML: targetVol,
      baseOils: (r.baseOils as Recipe['baseOils']).map((b) => ({
        name: b.name ?? '',
        ratio: typeof b.ratio === 'number' ? b.ratio : 1,
      })),
      categories: (r.categories as Recipe['categories']).map((cat) => ({
        id: cat.id || crypto.randomUUID(),
        name: typeof cat.name === 'string' ? cat.name : 'Category',
        essentialOils: (cat.essentialOils ?? []).map((eo) => ({
          id: eo.id || crypto.randomUUID(),
          name: eo.name ?? '',
          drops: typeof eo.drops === 'number' ? eo.drops : 0,
          maxPercentLimit:
            typeof eo.maxPercentLimit === 'number' ? eo.maxPercentLimit : null,
        })),
      })),
    }
    if (recipe.categories.length === 0) {
      return migrateRecipeV1ToV2(r)
    }
    if (!recipe.baseOils.length) {
      recipe.baseOils = [
        {
          name: 'Jojoba',
          ratio: 1,
        },
      ]
    }
    return recipe
  }
  return migrateRecipeV1ToV2(r)
}
