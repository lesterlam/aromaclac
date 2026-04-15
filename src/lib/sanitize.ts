import DOMPurify from 'dompurify'

/**
 * Sanitize input for safe display in the DOM.
 * Removes all HTML tags and potentially dangerous content.
 */
export function sanitizeForDisplay(input: string): string {
  const trimmed = input.trim().slice(0, 500)
  // Always use regex-based stripping for reliability across environments
  // This removes all HTML tags including potentially dangerous ones
  return trimmed.replace(/<[^>]*>/g, '')
}

/**
 * Sanitize input for safe use in filenames.
 * Removes or replaces characters that are unsafe for file systems.
 */
export function sanitizeForFilename(input: string): string {
  return input
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\.{2,}/g, '')
    .replace(/\s+/g, '_')
    .trim()
    .slice(0, 100)
}

/**
 * Sanitize input for safe use in HTML attributes.
 * Removes quotes and dangerous characters.
 */
export function sanitizeForAttribute(input: string): string {
  if (typeof window === 'undefined') {
    return input.trim().replace(/[<>"'&]/g, '')
  }
  return DOMPurify.sanitize(input.trim(), {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  }).replace(/[<>"'&]/g, '')
}

/**
 * Sanitize input for use in JSON (escape special characters).
 * Safe for storage and display.
 */
export function sanitizeForJson(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

/**
 * Sanitize oil/recipe names - allows letters, numbers, spaces, and common punctuation.
 */
export function sanitizeOilName(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/[^\w\s\-'.]/g, '')
    .trim()
    .slice(0, 100)
}