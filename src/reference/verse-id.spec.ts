import { describe, expect, it } from 'vitest'
import { decodeVerseId, makeVerseId } from './verse-id'

describe('makeVerseId', () => {
  it('encodes John 15:4 as 43015004 (BBBCCCVVV)', () => {
    expect(makeVerseId(43, 15, 4)).toBe(43015004)
  })

  it('encodes Genesis 1:1 as 1001001', () => {
    expect(makeVerseId(1, 1, 1)).toBe(1001001)
  })

  it('encodes Revelation 22:21 as 66022021', () => {
    expect(makeVerseId(66, 22, 21)).toBe(66022021)
  })

  it('encodes Psalm 119:176 as 19119176', () => {
    expect(makeVerseId(19, 119, 176)).toBe(19119176)
  })
})

describe('decodeVerseId', () => {
  it('decodes 43015004 to John 15:4', () => {
    expect(decodeVerseId(43015004)).toEqual({ book: 43, chapter: 15, verse: 4 })
  })

  it('decodes 1001001 to Genesis 1:1', () => {
    expect(decodeVerseId(1001001)).toEqual({ book: 1, chapter: 1, verse: 1 })
  })

  it('decodes 19119176 to Psalm 119:176', () => {
    expect(decodeVerseId(19119176)).toEqual({
      book: 19,
      chapter: 119,
      verse: 176,
    })
  })
})
