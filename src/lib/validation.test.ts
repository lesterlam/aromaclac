import { describe, it, expect } from 'vitest'
import {
  validateFileSize,
  checkDataLimits,
  sanitizeErrorMessage,
  isValidBackupStructure,
  MAX_FILE_SIZE_BYTES,
  MAX_OILS_PER_IMPORT,
  MAX_RECIPES_PER_IMPORT,
} from './validation'

describe('validation', () => {
  describe('validateFileSize', () => {
    it('should return valid for small content', () => {
      const result = validateFileSize('{}')
      expect(result.valid).toBe(true)
      expect(result.data).toBeGreaterThan(0)
    })

    it('should reject content exceeding max size', () => {
      // Create content larger than MAX_FILE_SIZE_BYTES
      const largeContent = 'x'.repeat(MAX_FILE_SIZE_BYTES + 1)
      const result = validateFileSize(largeContent)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('File too large')
    })

    it('should include max size in error message', () => {
      const largeContent = 'x'.repeat(MAX_FILE_SIZE_BYTES + 1)
      const result = validateFileSize(largeContent)
      expect(result.error).toContain('5MB')
    })
  })

  describe('checkDataLimits', () => {
    it('should return valid for empty arrays', () => {
      const result = checkDataLimits([], [])
      expect(result.valid).toBe(true)
    })

    it('should return valid for data within limits', () => {
      const oils = Array(MAX_OILS_PER_IMPORT).fill(null)
      const recipes = Array(MAX_RECIPES_PER_IMPORT).fill(null)
      const result = checkDataLimits(oils, recipes)
      expect(result.valid).toBe(true)
    })

    it('should reject too many oils', () => {
      const oils = Array(MAX_OILS_PER_IMPORT + 1).fill(null)
      const result = checkDataLimits(oils, [])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Too many oils')
    })

    it('should reject too many recipes', () => {
      const recipes = Array(MAX_RECIPES_PER_IMPORT + 1).fill(null)
      const result = checkDataLimits([], recipes)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Too many recipes')
    })

    it('should include count in error message', () => {
      const oils = Array(1500).fill(null)
      const result = checkDataLimits(oils, [])
      expect(result.error).toContain('1500')
    })
  })

  describe('sanitizeErrorMessage', () => {
    it('should return user-friendly messages as-is', () => {
      expect(sanitizeErrorMessage(new Error('Invalid backup format'))).toBe('Invalid backup format')
      expect(sanitizeErrorMessage(new Error('File too large'))).toBe('File too large')
    })

    it('should return generic message for unknown errors', () => {
      const result = sanitizeErrorMessage(new Error('Internal error 12345'))
      expect(result).toBe('An unexpected error occurred. Please try again.')
    })

    it('should handle non-Error objects', () => {
      expect(sanitizeErrorMessage('string error')).toBe('An unexpected error occurred. Please try again.')
      expect(sanitizeErrorMessage(null)).toBe('An unexpected error occurred. Please try again.')
      expect(sanitizeErrorMessage(undefined)).toBe('An unexpected error occurred. Please try again.')
    })
  })

  describe('isValidBackupStructure', () => {
    it('should return invalid for null/undefined', () => {
      expect(isValidBackupStructure(null)).toEqual({ valid: false, isV2: false })
      expect(isValidBackupStructure(undefined)).toEqual({ valid: false, isV2: false })
    })

    it('should return invalid for non-objects', () => {
      expect(isValidBackupStructure('string')).toEqual({ valid: false, isV2: false })
      expect(isValidBackupStructure(123)).toEqual({ valid: false, isV2: false })
    })

    it('should return invalid for missing recipes array', () => {
      expect(isValidBackupStructure({})).toEqual({ valid: false, isV2: false })
      expect(isValidBackupStructure({ oils: [] })).toEqual({ valid: false, isV2: false })
    })

    it('should return valid for V1 format', () => {
      const result = isValidBackupStructure({ recipes: [] })
      expect(result.valid).toBe(true)
      expect(result.isV2).toBe(false)
    })

    it('should return valid for V2 format', () => {
      const result = isValidBackupStructure({ version: 2, recipes: [] })
      expect(result.valid).toBe(true)
      expect(result.isV2).toBe(true)
    })
  })
})