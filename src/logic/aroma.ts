import type {
  BaseOilRow,
  EssentialOilLine,
  Recipe,
} from '../db/schema'

/** Milliliters per drop (20 drops = 1 ml). */
export const ML_PER_DROP = 0.05

export interface BaseOilCalculated extends BaseOilRow {
  calculatedML: number
}

/**
 * Anchor: one base oil with fixed volume; others scale by ratio × mlPerPart.
 * PRD §4.1 + implementation snippet.
 */
export function calculateBaseVolumes(baseOils: BaseOilRow[]): BaseOilCalculated[] {
  const fixed = baseOils.find((b) => b.isFixedVolume)
  if (!fixed) {
    return baseOils.map((b) => ({ ...b, calculatedML: 0 }))
  }
  const ratio = fixed.ratio
  if (!ratio || ratio === 0) {
    return baseOils.map((b) => ({
      ...b,
      calculatedML: b.isFixedVolume ? fixed.volumeML : 0,
    }))
  }
  const mlPerPart = fixed.volumeML / ratio
  return baseOils.map((b) => ({
    ...b,
    calculatedML: b.ratio * mlPerPart,
  }))
}

export function totalBaseMlFromRows(rows: BaseOilCalculated[]): number {
  return rows.reduce((s, b) => s + Math.max(0, b.calculatedML), 0)
}

/**
 * Safety vs base volume only. maxPercentLimit is % of base (e.g. 1 = 1%).
 * Matches PRD §6 snippet.
 */
export function getSafetyStatus(
  drops: number,
  maxPercentLimit: number | null | undefined,
  totalBaseML: number,
): {
  currentPercent: number | null
  currentPercentDisplay: string
  isSafe: boolean
  suggestedBaseML: number | null
} {
  const oilML = Math.max(0, drops) * ML_PER_DROP
  const hasLimit =
    maxPercentLimit != null &&
    typeof maxPercentLimit === 'number' &&
    maxPercentLimit > 0

  const suggestedBaseML = hasLimit ? oilML / (maxPercentLimit / 100) : null

  if (totalBaseML <= 0) {
    return {
      currentPercent: null,
      currentPercentDisplay: '—',
      isSafe: !hasLimit || oilML === 0,
      suggestedBaseML,
    }
  }

  const currentPercent = (oilML / totalBaseML) * 100
  const isSafe = hasLimit ? currentPercent <= maxPercentLimit : true

  return {
    currentPercent,
    currentPercentDisplay: currentPercent.toFixed(2),
    isSafe,
    suggestedBaseML,
  }
}

export interface EssentialOilLineFlat extends EssentialOilLine {
  categoryId: string
  categoryName: string
}

export function flattenEssentialOils(recipe: Recipe): EssentialOilLineFlat[] {
  const out: EssentialOilLineFlat[] = []
  for (const cat of recipe.categories ?? []) {
    for (const line of cat.essentialOils ?? []) {
      out.push({ ...line, categoryId: cat.id, categoryName: cat.name })
    }
  }
  return out
}

export function totalDropsInRecipe(recipe: Recipe): number {
  let n = 0
  for (const cat of recipe.categories ?? []) {
    for (const line of cat.essentialOils ?? []) {
      n += Math.max(0, line.drops)
    }
  }
  return n
}

export function dropsInCategory(
  recipe: Recipe,
  categoryId: string,
): number {
  const cat = recipe.categories?.find((c) => c.id === categoryId)
  if (!cat) return 0
  return cat.essentialOils.reduce((s, l) => s + Math.max(0, l.drops), 0)
}

/** UI / CSV: ml rounded to 2 decimal places. */
export function roundMlForDisplay(ml: number): number {
  return Math.round(ml * 100) / 100
}
