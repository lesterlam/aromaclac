import { describe, expect, it } from 'vitest'
import {
  ML_PER_DROP,
  calculateBaseVolumes,
  getSafetyStatus,
  totalBaseMlFromRows,
} from './aroma'

describe('calculateBaseVolumes', () => {
  it('scales from fixed anchor (PRD example)', () => {
    const rows = calculateBaseVolumes([
      { name: 'Sesame', ratio: 1.2, isFixedVolume: false, volumeML: 0 },
      { name: 'Jojoba', ratio: 1, isFixedVolume: true, volumeML: 50 },
    ])
    expect(rows.find((r) => r.name === 'Jojoba')?.calculatedML).toBeCloseTo(
      50,
      10,
    )
    expect(rows.find((r) => r.name === 'Sesame')?.calculatedML).toBeCloseTo(
      60,
      10,
    )
    expect(totalBaseMlFromRows(rows)).toBeCloseTo(110, 10)
  })
})

describe('getSafetyStatus', () => {
  it('matches PRD snippet: current% vs limit', () => {
    const drops = 10
    const oilML = drops * ML_PER_DROP
    const totalBase = 100
    const max = 1
    const r = getSafetyStatus(drops, max, totalBase)
    expect(r.currentPercent).toBeCloseTo((oilML / totalBase) * 100, 10)
    expect(r.isSafe).toBe(r.currentPercent! <= max)
    expect(r.suggestedBaseML).toBeCloseTo(oilML / (max / 100), 10)
  })
})
