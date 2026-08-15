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

describe('parseReference — single-chapter books', () => {
  const jude = (verse: number) => makeVerseId(65, 1, verse)

  it('parses a bare verse number as a verse in the only chapter', () => {
    expect(parseReference('Jude 3')?.reference).toEqual({
      book: 65,
      ranges: [{ startId: jude(3), endId: jude(3) }],
    })
    expect(parseReference('Obadiah 21')?.reference).toEqual({
      book: 31,
      ranges: [{ startId: makeVerseId(31, 1, 21), endId: makeVerseId(31, 1, 21) }],
    })
    expect(parseReference('Philemon 6')?.reference).toEqual({
      book: 57,
      ranges: [{ startId: makeVerseId(57, 1, 6), endId: makeVerseId(57, 1, 6) }],
    })
  })

  it('parses bare verse ranges and comma lists', () => {
    expect(parseReference('Jude 3-5')?.reference).toEqual({
      book: 65,
      ranges: [{ startId: jude(3), endId: jude(5) }],
    })
    expect(parseReference('Jude 3,5')?.reference).toEqual({
      book: 65,
      ranges: [
        { startId: jude(3), endId: jude(3) },
        { startId: jude(5), endId: jude(5) },
      ],
    })
  })

  it('still accepts the explicit chapter form', () => {
    expect(parseReference('Jude 1:3')?.reference).toEqual({
      book: 65,
      ranges: [{ startId: jude(3), endId: jude(3) }],
    })
  })

  it('rejects out-of-range verses and chapters', () => {
    expect(parseReference('Jude 26')).toBeNull()
    expect(parseReference('Jude 2:1')).toBeNull()
  })
})

describe('parseReference — book name forms', () => {
  it('parses multi-word book names', () => {
    expect(parseReference('Song of Solomon 2:1')?.reference.book).toBe(22)
    expect(parseReference('1 Samuel 3:10')?.reference.book).toBe(9)
    expect(parseReference('2 Kings 2:11')?.reference.book).toBe(12)
  })

  it('parses abbreviations with an optional trailing period', () => {
    expect(parseReference('Gen. 1:1')?.reference.book).toBe(1)
    expect(parseReference('Jhn 3:16')?.reference.book).toBe(43)
    expect(parseReference('1Jn 1:9')?.reference.book).toBe(62)
    expect(parseReference('1 Jn 1:9')?.reference.book).toBe(62)
  })

  it('matches book names case-insensitively', () => {
    expect(parseReference('john 15:4')?.reference.book).toBe(43)
    expect(parseReference('SONG OF SOLOMON 2:1')?.reference.book).toBe(22)
  })
})

describe('parseReference — option tokens', () => {
  const options = { translationIds: ['nkjv', 'web', 'kjv'] }

  it('parses a translation token', () => {
    const parsed = parseReference('John 15:4 nkjv', options)
    expect(parsed?.translation).toBe('nkjv')
    expect(parsed?.display).toBeNull()
    expect(parsed?.invalidTokens).toEqual([])
  })

  it('parses translation and display keyword in any order', () => {
    const first = parseReference('John 15:4 nkjv callout', options)
    expect(first?.translation).toBe('nkjv')
    expect(first?.display).toBe('callout')

    const second = parseReference('John 15:4 inline web', options)
    expect(second?.translation).toBe('web')
    expect(second?.display).toBe('inline')
  })

  it('matches option tokens case-insensitively', () => {
    const parsed = parseReference('John 15:4 NKJV Inline', options)
    expect(parsed?.translation).toBe('nkjv')
    expect(parsed?.display).toBe('inline')
  })

  it('flags unknown tokens as invalid and keeps the reference valid', () => {
    const parsed = parseReference('John 15:4 bogus', options)
    expect(parsed?.reference.book).toBe(43)
    expect(parsed?.translation).toBeNull()
    expect(parsed?.invalidTokens).toEqual([
      { text: 'bogus', start: 10, end: 15 },
    ])
  })

  it('keeps the first valid token when duplicates or conflicts follow', () => {
    const duplicated = parseReference('John 15:4 nkjv web', options)
    expect(duplicated?.translation).toBe('nkjv')
    expect(duplicated?.invalidTokens).toEqual([
      { text: 'web', start: 15, end: 18 },
    ])

    const conflicting = parseReference('John 15:4 callout inline', options)
    expect(conflicting?.display).toBe('callout')
    expect(conflicting?.invalidTokens).toEqual([
      { text: 'inline', start: 18, end: 24 },
    ])
  })

  it('treats every non-keyword token as invalid when no translations are known', () => {
    const parsed = parseReference('John 15:4 nkjv')
    expect(parsed?.translation).toBeNull()
    expect(parsed?.invalidTokens).toEqual([
      { text: 'nkjv', start: 10, end: 14 },
    ])
  })
})
