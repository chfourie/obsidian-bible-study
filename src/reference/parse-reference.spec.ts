import { describe, expect, it } from 'vitest'
import { parseReference } from './parse-reference'
import { makeVerseId } from './verse-id'

const john = (chapter: number, verse: number) => makeVerseId(43, chapter, verse)

describe('parseReference — single verse', () => {
  it('parses John 15:4 to a normalized reference', () => {
    expect(parseReference('John 15:4')).toEqual({
      reference: {
        book: 43,
        ranges: [{ startId: john(15, 4), endId: john(15, 4) }],
      },
      translation: null,
      display: null,
      invalidTokens: [],
    })
  })

  it('rejects an unknown book', () => {
    expect(parseReference('Johnny 15:4')).toBeNull()
  })

  it('rejects an out-of-range chapter', () => {
    expect(parseReference('John 22:1')).toBeNull()
  })

  it('rejects an out-of-range verse', () => {
    expect(parseReference('John 15:28')).toBeNull()
  })

  it('rejects a whole-book reference', () => {
    expect(parseReference('John')).toBeNull()
  })

  it('rejects empty and malformed input', () => {
    expect(parseReference('')).toBeNull()
    expect(parseReference('15:4')).toBeNull()
    expect(parseReference('John :4')).toBeNull()
    expect(parseReference('John 15:')).toBeNull()
    expect(parseReference('John 15:4:6')).toBeNull()
    expect(parseReference('John fifteen:4')).toBeNull()
  })
})
