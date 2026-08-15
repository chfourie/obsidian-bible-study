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

describe('parseReference — verse forms', () => {
  it('parses an intra-chapter range', () => {
    expect(parseReference('John 15:1-17')?.reference).toEqual({
      book: 43,
      ranges: [{ startId: john(15, 1), endId: john(15, 17) }],
    })
  })

  it('parses a whole chapter', () => {
    expect(parseReference('John 15')?.reference).toEqual({
      book: 43,
      ranges: [{ startId: john(15, 1), endId: john(15, 27) }],
    })
  })

  it('rejects an out-of-range whole chapter', () => {
    expect(parseReference('John 22')).toBeNull()
  })

  it('parses a cross-chapter range', () => {
    expect(parseReference('John 15:26-16:4')?.reference).toEqual({
      book: 43,
      ranges: [{ startId: john(15, 26), endId: john(16, 4) }],
    })
  })

  it('parses comma lists', () => {
    expect(parseReference('John 15:4,7')?.reference).toEqual({
      book: 43,
      ranges: [
        { startId: john(15, 4), endId: john(15, 4) },
        { startId: john(15, 7), endId: john(15, 7) },
      ],
    })
    expect(parseReference('John 15:4-6,9')?.reference).toEqual({
      book: 43,
      ranges: [
        { startId: john(15, 4), endId: john(15, 6) },
        { startId: john(15, 9), endId: john(15, 9) },
      ],
    })
  })

  it('normalizes comma lists: sorted, duplicates and overlaps merged', () => {
    expect(parseReference('John 15:9,4-6')?.reference).toEqual({
      book: 43,
      ranges: [
        { startId: john(15, 4), endId: john(15, 6) },
        { startId: john(15, 9), endId: john(15, 9) },
      ],
    })
    expect(parseReference('John 15:4-6,5-9')?.reference).toEqual({
      book: 43,
      ranges: [{ startId: john(15, 4), endId: john(15, 9) }],
    })
    expect(parseReference('John 15:4,5')?.reference).toEqual({
      book: 43,
      ranges: [{ startId: john(15, 4), endId: john(15, 5) }],
    })
  })

  it('rejects reversed ranges', () => {
    expect(parseReference('John 15:17-1')).toBeNull()
    expect(parseReference('John 16:4-15:26')).toBeNull()
  })

  it('rejects multi-chapter dash ranges without verse numbers', () => {
    expect(parseReference('John 15-16')).toBeNull()
  })

  it('rejects comma lists with invalid members', () => {
    expect(parseReference('John 15:4,28')).toBeNull()
    expect(parseReference('John 15:4,')).toBeNull()
  })
})
