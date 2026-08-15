import { describe, expect, it } from 'vitest'
import { chapterCount, verseCount } from './versification'

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
