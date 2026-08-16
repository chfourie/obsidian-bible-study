import { describe, expect, it } from 'vitest'
import {
  chapterCount,
  isValidVerseId,
  nextVerse,
  ordinalToVerseId,
  verseCount,
  verseIdToOrdinal,
} from './versification'
import { makeVerseId } from './verse-id'

const KJV_CHAPTER_COUNTS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150,
  31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16,
  24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1,
  1, 22,
]

const KJV_BOOK_VERSE_TOTALS = [
  1533, 1213, 859, 1288, 959, 658, 618, 85, 810, 695, 816, 719, 942, 822, 280,
  406, 167, 1070, 2461, 915, 222, 117, 1292, 1364, 154, 1273, 357, 197, 73,
  146, 21, 48, 105, 47, 56, 53, 38, 211, 55, 1071, 678, 1151, 879, 1007, 433,
  437, 257, 149, 155, 104, 95, 89, 47, 113, 83, 46, 25, 303, 108, 105, 61, 105,
  13, 14, 25, 404,
]

describe('chapterCount', () => {
  it('matches the KJV chapter count for every book', () => {
    for (let book = 1; book <= 66; book++) {
      expect(chapterCount(book), `book ${book}`).toBe(
        KJV_CHAPTER_COUNTS[book - 1],
      )
    }
  })

  it('sums to 1,189 chapters across the canon', () => {
    let total = 0
    for (let book = 1; book <= 66; book++) total += chapterCount(book)
    expect(total).toBe(1189)
  })
})

describe('verseCount', () => {
  it('reports well-known chapter lengths', () => {
    expect(verseCount(1, 1)).toBe(31)
    expect(verseCount(19, 117)).toBe(2)
    expect(verseCount(19, 119)).toBe(176)
    expect(verseCount(43, 15)).toBe(27)
    expect(verseCount(43, 3)).toBe(36)
    expect(verseCount(31, 1)).toBe(21)
    expect(verseCount(65, 1)).toBe(25)
    expect(verseCount(66, 22)).toBe(21)
    expect(verseCount(2, 20)).toBe(26)
    expect(verseCount(23, 53)).toBe(12)
  })

  it('matches the KJV per-book verse totals for every book', () => {
    for (let book = 1; book <= 66; book++) {
      let total = 0
      for (let chapter = 1; chapter <= chapterCount(book); chapter++) {
        total += verseCount(book, chapter)
      }
      expect(total, `book ${book}`).toBe(KJV_BOOK_VERSE_TOTALS[book - 1])
    }
  })

  it('sums to 31,102 verses across the canon', () => {
    let total = 0
    for (let book = 1; book <= 66; book++) {
      for (let chapter = 1; chapter <= chapterCount(book); chapter++) {
        total += verseCount(book, chapter)
      }
    }
    expect(total).toBe(31102)
  })
})

describe('isValidVerseId', () => {
  it('accepts verses on the grid', () => {
    expect(isValidVerseId(makeVerseId(43, 15, 4))).toBe(true)
    expect(isValidVerseId(makeVerseId(1, 1, 1))).toBe(true)
    expect(isValidVerseId(makeVerseId(66, 22, 21))).toBe(true)
    expect(isValidVerseId(makeVerseId(19, 119, 176))).toBe(true)
  })

  it('rejects out-of-range verse numbers', () => {
    expect(isValidVerseId(makeVerseId(43, 15, 28))).toBe(false)
    expect(isValidVerseId(makeVerseId(43, 15, 0))).toBe(false)
  })

  it('rejects out-of-range chapters', () => {
    expect(isValidVerseId(makeVerseId(43, 22, 1))).toBe(false)
    expect(isValidVerseId(makeVerseId(43, 0, 1))).toBe(false)
  })

  it('rejects out-of-range books', () => {
    expect(isValidVerseId(makeVerseId(67, 1, 1))).toBe(false)
    expect(isValidVerseId(makeVerseId(0, 1, 1))).toBe(false)
  })
})

describe('nextVerse', () => {
  it('steps within a chapter', () => {
    expect(nextVerse(makeVerseId(43, 15, 4))).toBe(makeVerseId(43, 15, 5))
  })

  it('steps across a chapter boundary', () => {
    expect(nextVerse(makeVerseId(43, 15, 27))).toBe(makeVerseId(43, 16, 1))
  })

  it('steps across a book boundary', () => {
    expect(nextVerse(makeVerseId(39, 4, 6))).toBe(makeVerseId(40, 1, 1))
  })

  it('returns null after the last verse of the canon', () => {
    expect(nextVerse(makeVerseId(66, 22, 21))).toBeNull()
  })

  it('returns null for an off-grid id', () => {
    expect(nextVerse(makeVerseId(43, 15, 28))).toBeNull()
  })
})

describe('ordinal mapping', () => {
  it('maps Genesis 1:1 to ordinal 0', () => {
    expect(verseIdToOrdinal(makeVerseId(1, 1, 1))).toBe(0)
  })

  it('maps Genesis 2:1 to ordinal 31 (after the 31 verses of chapter 1)', () => {
    expect(verseIdToOrdinal(makeVerseId(1, 2, 1))).toBe(31)
  })

  it('maps Matthew 1:1 to ordinal 23,145 (the OT verse total)', () => {
    expect(verseIdToOrdinal(makeVerseId(40, 1, 1))).toBe(23145)
  })

  it('maps John 1:1 to ordinal 26,045', () => {
    expect(verseIdToOrdinal(makeVerseId(43, 1, 1))).toBe(26045)
  })

  it('maps Revelation 22:21 to ordinal 31,101 (last verse of the canon)', () => {
    expect(verseIdToOrdinal(makeVerseId(66, 22, 21))).toBe(31101)
  })

  it('returns null for an off-grid id', () => {
    expect(verseIdToOrdinal(makeVerseId(43, 15, 28))).toBeNull()
  })

  it('returns null for an out-of-range ordinal', () => {
    expect(ordinalToVerseId(-1)).toBeNull()
    expect(ordinalToVerseId(31102)).toBeNull()
  })

  it('round-trips every ordinal on the grid', () => {
    let verseId: number | null = makeVerseId(1, 1, 1)
    for (let ordinal = 0; ordinal < 31102; ordinal++) {
      expect(ordinalToVerseId(ordinal)).toBe(verseId)
      expect(verseIdToOrdinal(verseId as number)).toBe(ordinal)
      verseId = nextVerse(verseId as number)
    }
    expect(verseId).toBeNull()
  })
})
