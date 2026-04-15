import { describe, it, expect } from 'vitest'
import {
  sanitizeForDisplay,
  sanitizeForFilename,
  sanitizeForAttribute,
  sanitizeForJson,
  sanitizeOilName,
} from './sanitize'

describe('sanitizeForDisplay', () => {
  it('removes HTML tags', () => {
    // In jsdom/test environment, uses regex fallback which strips HTML tags
    const result = sanitizeForDisplay('<script>alert(1)</script>Test')
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('</script>')
  })

  it('removes self-closing tags', () => {
    // In jsdom/test environment, uses regex fallback
    const result = sanitizeForDisplay('<img src=x onerror=alert(1)>')
    expect(result).not.toContain('<img')
  })

  it('removes iframe tags', () => {
    // In jsdom/test environment, uses regex fallback
    const result = sanitizeForDisplay('<iframe src="evil.com"></iframe>Safe')
    expect(result).not.toContain('<iframe>')
    expect(result).not.toContain('</iframe>')
  })

  it('preserves plain text', () => {
    expect(sanitizeForDisplay('  Lavender Essential Oil  ')).toBe('Lavender Essential Oil')
  })

  it('handles empty input', () => {
    expect(sanitizeForDisplay('')).toBe('')
    expect(sanitizeForDisplay('   ')).toBe('')
  })
})

describe('sanitizeForFilename', () => {
  it('removes angle brackets from filenames', () => {
    // < and > are removed, leaving 'script' text
    expect(sanitizeForFilename('test<script>.json')).toBe('testscript.json')
  })

  it('removes path traversal characters', () => {
    // . and / are removed
    expect(sanitizeForFilename('../../../etc/passwd')).toBe('etcpasswd')
  })

  it('removes quotes', () => {
    expect(sanitizeForFilename('file"name.json')).toBe('filename.json')
  })

  it('replaces spaces with underscores', () => {
    expect(sanitizeForFilename('my recipe file.json')).toBe('my_recipe_file.json')
  })

  it('preserves safe characters', () => {
    expect(sanitizeForFilename('My-Recipe_v1.json')).toBe('My-Recipe_v1.json')
  })

  it('limits length to 100 chars', () => {
    const longName = 'a'.repeat(150)
    expect(sanitizeForFilename(longName).length).toBe(100)
  })
})

describe('sanitizeForAttribute', () => {
  it('removes quotes', () => {
    // " is removed but = stays
    expect(sanitizeForAttribute('value="test"')).toBe('value=test')
  })

  it('removes angle brackets', () => {
    expect(sanitizeForAttribute('<script>')).toBe('script')
  })

  it('removes dangerous ampersands', () => {
    // & is removed as it's dangerous in HTML attributes
    expect(sanitizeForAttribute('a & b')).toBe('a  b')
  })
})

describe('sanitizeForJson', () => {
  it('escapes backslashes', () => {
    expect(sanitizeForJson('path\\to\\file')).toBe('path\\\\to\\\\file')
  })

  it('escapes quotes', () => {
    expect(sanitizeForJson('say "hello"')).toBe('say \\"hello\\"')
  })

  it('escapes newlines', () => {
    expect(sanitizeForJson('line1\nline2')).toBe('line1\\nline2')
  })

  it('escapes tabs', () => {
    expect(sanitizeForJson('col1\tcol2')).toBe('col1\\tcol2')
  })
})

describe('sanitizeOilName', () => {
  it('allows letters and spaces', () => {
    expect(sanitizeOilName('Lavender Essential Oil')).toBe('Lavender Essential Oil')
  })

  it('allows hyphens and apostrophes', () => {
    expect(sanitizeOilName("Lavender's Best - Formula")).toBe("Lavender's Best - Formula")
  })

  it('removes dangerous characters', () => {
    // < and > are removed, script stays as text
    const result = sanitizeOilName('Lavender<script>alert(1)</script>')
    expect(result).not.toContain('<')
    expect(result).not.toContain('>')
  })

  it('removes angle brackets', () => {
    // < and > are removed, 3 stays
    expect(sanitizeOilName('Oil <3')).toBe('Oil 3')
  })

  it('limits length to 100 chars', () => {
    const longName = 'a'.repeat(150)
    expect(sanitizeOilName(longName).length).toBe(100)
  })

  it('trims whitespace', () => {
    expect(sanitizeOilName('  Lavender  ')).toBe('Lavender')
  })
})