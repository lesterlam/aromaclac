import { z } from 'zod'
import type { Recipe, Oil } from '../db/schema'

// ============================================================================
// Constants & Limits
// ============================================================================

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
export const MAX_OILS_PER_IMPORT = 1000
export const MAX_RECIPES_PER_IMPORT = 100
export const MAX_NAME_LENGTH = 100
export const MAX_DROPS_PER_OIL = 10000
export const MAX_CATEGORIES_PER_RECIPE = 50
export const MAX_OILS_PER_CATEGORY = 200
export const MAX_JSON_DEPTH = 15 // Maximum nesting depth for JSON objects
export const MAX_TOTAL_ELEMENTS = 50000 // Maximum total elements across all arrays

/**
 * Validate JSON structure depth to prevent DoS attacks via deeply nested JSON.
 */
export function validateJsonDepth(
  obj: unknown,
  currentDepth = 0,
  maxDepth = MAX_JSON_DEPTH,
): { valid: boolean; error?: string } {
  if (currentDepth > maxDepth) {
    return {
      valid: false,
      error: `JSON structure too deeply nested (max ${maxDepth} levels)`,
    }
  }

  if (Array.isArray(obj)) {
    if (obj.length > MAX_TOTAL_ELEMENTS) {
      return {
        valid: false,
        error: `Too many elements in array (max ${MAX_TOTAL_ELEMENTS})`,
      }
    }
    for (const item of obj) {
      const result = validateJsonDepth(item, currentDepth + 1, maxDepth)
      if (!result.valid) return result
    }
  } else if (obj && typeof obj === 'object') {
    const keys = Object.keys(obj as Record<string, unknown>)
    if (keys.length > 1000) {
      return {
        valid: false,
        error: `Too many properties in object (max 1000)`,
      }
    }
    for (const key of keys) {
      const result = validateJsonDepth(
        (obj as Record<string, unknown>)[key],
        currentDepth + 1,
        maxDepth,
      )
      if (!result.valid) return result
    }
  }

  return { valid: true }
}

/**
 * Validate MIME type from file content (magic bytes check).
 * Basic check for JSON files.
 */
export function validateJsonMimeType(
  content: string,
): { valid: boolean; error?: string } {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return {
      valid: false,
      error: 'Invalid file format. Expected JSON file.',
    }
  }
  return { valid: true }
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Schema for essential oil line validation.
 */
export const essentialOilLineSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(0).max(MAX_NAME_LENGTH),
  drops: z.number().int().min(0).max(MAX_DROPS_PER_OIL),
  maxPercentLimit: z.number().nullable(),
})

/**
 * Schema for recipe category validation.
 */
export const recipeCategorySchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(0).max(MAX_NAME_LENGTH),
  essentialOils: z.array(essentialOilLineSchema),
})

/**
 * Schema for base oil row validation.
 */
export const baseOilRowSchema = z.object({
  name: z.string().min(0).max(MAX_NAME_LENGTH),
  ratio: z.number().min(0).max(100),
})

/**
 * Schema for recipe validation.
 */
export const recipeSchema = z.object({
  id: z.string().min(1).max(50),
  title: z.string().min(0).max(MAX_NAME_LENGTH),
  description: z.string().min(0).max(1000),
  targetVolumeML: z.number().min(0).max(10000),
  baseOils: z.array(baseOilRowSchema),
  categories: z.array(recipeCategorySchema),
})

/**
 * Schema for oil library entry validation.
 */
export const oilSchema = z.object({
  name: z.string().min(1).max(MAX_NAME_LENGTH),
  lastUsedMaxPercent: z.number().nullable(),
})

/**
 * Schema for V2 backup file validation.
 */
export const backupPayloadV2Schema = z.object({
  version: z.literal(2),
  oils: z.array(oilSchema),
  recipes: z.array(recipeSchema),
})

// ============================================================================
// Validation Functions
// ============================================================================

export interface ValidationResult<T> {
  valid: boolean
  data?: T
  error?: string
}

/**
 * Validate file size before parsing.
 */
export function validateFileSize(content: string): ValidationResult<number> {
  const size = new Blob([content]).size
  if (size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
    }
  }
  return { valid: true, data: size }
}

/**
 * Validate and parse V2 backup JSON.
 */
export function validateBackupV2(json: unknown): ValidationResult<{
  oils: Oil[]
  recipes: Recipe[]
}> {
  try {
    // Check JSON structure depth first
    const depthCheck = validateJsonDepth(json)
    if (!depthCheck.valid) {
      return { valid: false, error: depthCheck.error }
    }

    const result = backupPayloadV2Schema.safeParse(json)
    if (result.success) {
      return {
        valid: true,
        data: {
          oils: result.data.oils,
          recipes: result.data.recipes,
        },
      }
    }
    return {
      valid: false,
      error: `Invalid backup format: ${result.error.issues.map(i => i.message).join(', ')}`,
    }
  } catch {
    return {
      valid: false,
      error: 'Failed to parse backup file.',
    }
  }
}

/**
 * Validate that JSON is a valid backup structure (without full schema validation).
 * Used for quick check before detailed validation.
 */
export function isValidBackupStructure(json: unknown): { valid: boolean; isV2: boolean } {
  if (!json || typeof json !== 'object') {
    return { valid: false, isV2: false }
  }

  const obj = json as Record<string, unknown>

  // Must have recipes array
  if (!Array.isArray(obj.recipes)) {
    return { valid: false, isV2: false }
  }

  // Check version to determine if V1 or V2
  const isV2 = obj.version === 2

  return { valid: true, isV2 }
}

/**
 * Sanitize an error message for display to users.
 * Removes internal details that shouldn't be exposed.
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Only return user-friendly messages, not technical details
    const userMessages = [
      'Invalid backup',
      'File too large',
      'Maximum',
      'expected',
    ]
    
    for (const msg of userMessages) {
      if (error.message.includes(msg)) {
        return error.message
      }
    }
    
    // For unknown errors, give a generic message
    return 'An unexpected error occurred. Please try again.'
  }
  return 'An unexpected error occurred. Please try again.'
}

/**
 * Check if backup data exceeds limits (for preview display).
 */
export function checkDataLimits(oils: unknown[], recipes: unknown[]): { valid: boolean; error?: string } {
  if (oils.length > MAX_OILS_PER_IMPORT) {
    return { valid: false, error: `Too many oils (${oils.length}). Maximum is ${MAX_OILS_PER_IMPORT}.` }
  }
  if (recipes.length > MAX_RECIPES_PER_IMPORT) {
    return { valid: false, error: `Too many recipes (${recipes.length}). Maximum is ${MAX_RECIPES_PER_IMPORT}.` }
  }
  return { valid: true }
}