import Papa from 'papaparse'
import type { Recipe } from '../db/schema'
import {
  calculateBaseVolumes,
  flattenEssentialOils,
  getSafetyStatus,
  roundMlForDisplay,
} from '../logic/aroma'
import { sanitizeOilName } from './sanitize'

/**
 * CSV row structure for recipe export.
 */
interface CsvRow {
  recipeName: string
  ingredient: string
  type: 'Base' | 'Essential'
  amount: string
  percentOfBase: string
}

/**
 * Build CSV rows for base oils.
 */
export function buildBaseOilRows(recipe: Recipe): CsvRow[] {
  const baseRows = calculateBaseVolumes(recipe.baseOils ?? [], recipe.targetVolumeML)
  const vbase = recipe.targetVolumeML
  // Sanitize recipe name for CSV
  const safeRecipeName = sanitizeOilName(recipe.title)

  return baseRows.map((b) => {
    const ml = roundMlForDisplay(b.calculatedML)
    return {
      recipeName: safeRecipeName,
      ingredient: sanitizeOilName(b.name || 'Base'),
      type: 'Base' as const,
      amount: `${ml.toFixed(2)} ml`,
      percentOfBase:
        vbase > 0 ? ((b.calculatedML / vbase) * 100).toFixed(2) : '0',
    }
  })
}

/**
 * Build CSV rows for essential oils.
 */
export function buildEssentialOilRows(recipe: Recipe): CsvRow[] {
  const vbase = recipe.targetVolumeML
  // Sanitize recipe name for CSV
  const safeRecipeName = sanitizeOilName(recipe.title)

  return flattenEssentialOils(recipe).map((line) => {
    const st = getSafetyStatus(line.drops, line.maxPercentLimit, vbase)
    return {
      recipeName: safeRecipeName,
      ingredient: sanitizeOilName(line.name),
      type: 'Essential' as const,
      amount: `${line.drops} drops`,
      percentOfBase: st.currentPercentDisplay,
    }
  })
}

/**
 * Export a recipe to CSV format.
 */
export function recipeToCsv(recipe: Recipe): string {
  const rows: CsvRow[] = [
    ...buildBaseOilRows(recipe),
    ...buildEssentialOilRows(recipe),
  ]

  return Papa.unparse(rows, { header: true })
}