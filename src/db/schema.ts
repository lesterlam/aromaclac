import Dexie, { type Table } from 'dexie'

/**
 * Learned library: name is unique. lastUsedMaxPercent is % of base (e.g. 1 = 1%), or null.
 */
export interface Oil {
  name: string
  lastUsedMaxPercent: number | null
}

export interface BaseOilRow {
  name: string
  ratio: number
  isFixedVolume: boolean
  volumeML: number
}

export interface EssentialOilLine {
  id: string
  name: string
  drops: number
  /** Max allowed % of base volume (e.g. 1 = 1%). */
  maxPercentLimit: number
}

export interface RecipeCategory {
  id: string
  name: string
  essentialOils: EssentialOilLine[]
}

export interface Recipe {
  id: string
  title: string
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
      : 10
  const oldBases = (r.baseOils as { name?: string; ratio?: number }[]) ?? []
  const baseOils: BaseOilRow[] =
    oldBases.length > 0
      ? oldBases.map((b, i) => ({
          name: b.name ?? '',
          ratio: typeof b.ratio === 'number' ? b.ratio : 1,
          isFixedVolume: i === 0,
          volumeML: i === 0 ? targetVol : 0,
        }))
      : [
          {
            name: 'Jojoba',
            ratio: 1,
            isFixedVolume: true,
            volumeML: targetVol,
          },
        ]

  const oldEo =
    (r.essentialOils as { name?: string; drops?: number }[]) ?? []
  const essentialOils: EssentialOilLine[] = oldEo.map((e) => ({
    id: newLineId(),
    name: e.name ?? '',
    drops: typeof e.drops === 'number' ? e.drops : 0,
    maxPercentLimit: 1,
  }))

  return {
    id: typeof r.id === 'string' ? r.id : crypto.randomUUID(),
    title: typeof r.title === 'string' ? r.title : 'Untitled',
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
  }
}

export const db = new AromaCalcDB()

/** Normalize JSON import: v2 shape or legacy v1 recipe. */
export function normalizeRecipeFromImport(raw: unknown): Recipe {
  const r = raw as Record<string, unknown>
  if (Array.isArray(r.categories) && Array.isArray(r.baseOils)) {
    const recipe: Recipe = {
      id: typeof r.id === 'string' ? r.id : crypto.randomUUID(),
      title: typeof r.title === 'string' ? r.title : 'Untitled',
      baseOils: (r.baseOils as Recipe['baseOils']).map((b) => ({
        name: b.name ?? '',
        ratio: typeof b.ratio === 'number' ? b.ratio : 1,
        isFixedVolume: Boolean(b.isFixedVolume),
        volumeML: typeof b.volumeML === 'number' ? b.volumeML : 0,
      })),
      categories: (r.categories as Recipe['categories']).map((cat) => ({
        id: cat.id || crypto.randomUUID(),
        name: typeof cat.name === 'string' ? cat.name : 'Category',
        essentialOils: (cat.essentialOils ?? []).map((eo) => ({
          id: eo.id || crypto.randomUUID(),
          name: eo.name ?? '',
          drops: typeof eo.drops === 'number' ? eo.drops : 0,
          maxPercentLimit:
            typeof eo.maxPercentLimit === 'number' ? eo.maxPercentLimit : 1,
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
          isFixedVolume: true,
          volumeML: 50,
        },
      ]
    }
    return recipe
  }
  return migrateRecipeV1ToV2(r)
}
