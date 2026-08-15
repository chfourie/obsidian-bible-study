import { describe, expect, it } from 'vitest'
import { formatReference } from './format-reference'
import { parseReference } from './parse-reference'

const formatted = (text: string): string => {
  const parsed = parseReference(text)
  if (!parsed) throw new Error(`unparseable: ${text}`)
  return formatReference(parsed.reference)
}

describe('formatReference', () => {
  it('formats a single verse', () => {
    expect(formatted('John 15:4')).toBe('John 15:4')
  })

  it('formats with the canonical book name', () => {
    expect(formatted('jhn 15:4')).toBe('John 15:4')
    expect(formatted('1Jn 1:9')).toBe('1 John 1:9')
    expect(formatted('song of solomon 2:1')).toBe('Song of Solomon 2:1')
  })

  it('formats an intra-chapter range', () => {
    expect(formatted('John 15:1-17')).toBe('John 15:1-17')
  })

  it('formats a whole chapter without verse numbers', () => {
    expect(formatted('John 15')).toBe('John 15')
    expect(formatted('John 15:1-27')).toBe('John 15')
  })

  it('formats a cross-chapter range', () => {
    expect(formatted('John 15:26-16:4')).toBe('John 15:26-16:4')
  })

  it('formats comma lists with chapter context carried forward', () => {
    expect(formatted('John 15:4-6,9')).toBe('John 15:4-6,9')
    expect(formatted('John 15:4,16:2')).toBe('John 15:4,16:2')
  })

  it('formats normalized (sorted, merged) output', () => {
    expect(formatted('John 15:9,4-6')).toBe('John 15:4-6,9')
    expect(formatted('John 15:4,5')).toBe('John 15:4-5')
  })

  it('round-trips through the parser', () => {
    for (const text of [
      'John 15:4',
      'John 15:1-17',
      'John 15',
      'John 15:26-16:4',
      'John 15:4-6,9',
      'Song of Solomon 2:1',
      'Psa 119:105',
    ]) {
      const canonical = formatted(text)
      expect(formatted(canonical)).toBe(canonical)
      expect(parseReference(canonical)?.reference).toEqual(
        parseReference(text)?.reference,
      )
    }
  })
})
