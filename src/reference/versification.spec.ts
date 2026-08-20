import { afterEach, describe, expect, it } from 'vitest'
import {
  chapterCount,
  deregisterBookVersification,
  isValidVerseId,
  nextVerse,
  ordinalToVerseId,
  registerBookVersification,
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

const SYNTHETIC_BOOK = 101

const registerSyntheticBook = (): void =>
  registerBookVersification({
    book: SYNTHETIC_BOOK,
    sections: [
      { chapter: 0, paragraphs: 4 },
      { chapter: 1, paragraphs: 3 },
      { chapter: 2, paragraphs: 5 },
    ],
  })

describe('book versification registry', () => {
  afterEach(() => deregisterBookVersification(SYNTHETIC_BOOK))

  it('reports no grid for an unregistered book', () => {
    expect(chapterCount(SYNTHETIC_BOOK)).toBe(0)
    expect(verseCount(SYNTHETIC_BOOK, 1)).toBe(0)
    expect(isValidVerseId(makeVerseId(SYNTHETIC_BOOK, 1, 1))).toBe(false)
  })

  it('makes a registered book countable', () => {
    registerSyntheticBook()
    expect(chapterCount(SYNTHETIC_BOOK)).toBe(3)
    expect(verseCount(SYNTHETIC_BOOK, 0)).toBe(4)
    expect(verseCount(SYNTHETIC_BOOK, 2)).toBe(5)
    expect(verseCount(SYNTHETIC_BOOK, 3)).toBe(0)
  })

  it('validates ids against the registered grid', () => {
    registerSyntheticBook()
    expect(isValidVerseId(makeVerseId(SYNTHETIC_BOOK, 0, 4))).toBe(true)
    expect(isValidVerseId(makeVerseId(SYNTHETIC_BOOK, 0, 5))).toBe(false)
    expect(isValidVerseId(makeVerseId(SYNTHETIC_BOOK, 2, 5))).toBe(true)
    expect(isValidVerseId(makeVerseId(SYNTHETIC_BOOK, 2, 0))).toBe(false)
  })

  it('steps through a registered book, including its chapter 0', () => {
    registerSyntheticBook()
    expect(nextVerse(makeVerseId(SYNTHETIC_BOOK, 0, 1))).toBe(
      makeVerseId(SYNTHETIC_BOOK, 0, 2),
    )
    expect(nextVerse(makeVerseId(SYNTHETIC_BOOK, 0, 4))).toBe(
      makeVerseId(SYNTHETIC_BOOK, 1, 1),
    )
    expect(nextVerse(makeVerseId(SYNTHETIC_BOOK, 2, 5))).toBeNull()
  })

  it('never chains a registered book onto another book', () => {
    registerBookVersification({
      book: SYNTHETIC_BOOK + 1,
      sections: [{ chapter: 1, paragraphs: 2 }],
    })
    try {
      registerSyntheticBook()
      expect(nextVerse(makeVerseId(SYNTHETIC_BOOK, 2, 5))).toBeNull()
    } finally {
      deregisterBookVersification(SYNTHETIC_BOOK + 1)
    }
  })

  it('keeps registered books out of the canon ordinal space', () => {
    registerSyntheticBook()
    expect(verseIdToOrdinal(makeVerseId(SYNTHETIC_BOOK, 1, 1))).toBeNull()
    expect(nextVerse(makeVerseId(66, 22, 21))).toBeNull()
    expect(ordinalToVerseId(31101)).toBe(makeVerseId(66, 22, 21))
  })

  it('reverts to the unregistered state on deregistration', () => {
    registerSyntheticBook()
    deregisterBookVersification(SYNTHETIC_BOOK)
    expect(chapterCount(SYNTHETIC_BOOK)).toBe(0)
    expect(isValidVerseId(makeVerseId(SYNTHETIC_BOOK, 1, 1))).toBe(false)
    expect(nextVerse(makeVerseId(SYNTHETIC_BOOK, 1, 1))).toBeNull()
  })

  it('replaces an earlier table for the same book', () => {
    registerSyntheticBook()
    registerBookVersification({
      book: SYNTHETIC_BOOK,
      sections: [{ chapter: 1, paragraphs: 9 }],
    })
    expect(chapterCount(SYNTHETIC_BOOK)).toBe(1)
    expect(verseCount(SYNTHETIC_BOOK, 0)).toBe(0)
    expect(verseCount(SYNTHETIC_BOOK, 1)).toBe(9)
  })

  it('rejects a table that would shadow the compiled canon', () => {
    expect(() =>
      registerBookVersification({
        book: 43,
        sections: [{ chapter: 1, paragraphs: 1 }],
      }),
    ).toThrow()
    expect(verseCount(43, 1)).toBe(51)
  })

  it('rejects an empty table', () => {
    expect(() =>
      registerBookVersification({ book: SYNTHETIC_BOOK, sections: [] }),
    ).toThrow()
    expect(chapterCount(SYNTHETIC_BOOK)).toBe(0)
  })

  it('rejects non-contiguous sections', () => {
    expect(() =>
      registerBookVersification({
        book: SYNTHETIC_BOOK,
        sections: [
          { chapter: 1, paragraphs: 3 },
          { chapter: 3, paragraphs: 3 },
        ],
      }),
    ).toThrow()
    expect(() =>
      registerBookVersification({
        book: SYNTHETIC_BOOK,
        sections: [
          { chapter: 2, paragraphs: 3 },
          { chapter: 1, paragraphs: 3 },
        ],
      }),
    ).toThrow()
    expect(chapterCount(SYNTHETIC_BOOK)).toBe(0)
  })

  it('rejects zero, negative, and fractional paragraph counts', () => {
    for (const paragraphs of [0, -1, 2.5]) {
      expect(() =>
        registerBookVersification({
          book: SYNTHETIC_BOOK,
          sections: [{ chapter: 1, paragraphs }],
        }),
      ).toThrow()
    }
    expect(chapterCount(SYNTHETIC_BOOK)).toBe(0)
  })

  it('rejects sections starting below chapter 0', () => {
    expect(() =>
      registerBookVersification({
        book: SYNTHETIC_BOOK,
        sections: [{ chapter: -1, paragraphs: 3 }],
      }),
    ).toThrow()
    expect(chapterCount(SYNTHETIC_BOOK)).toBe(0)
  })
})
