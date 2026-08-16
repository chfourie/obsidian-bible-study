import { VERSES_PER_CHAPTER } from './versification-data'
import { decodeVerseId, makeVerseId } from './verse-id'

export const BOOK_COUNT = VERSES_PER_CHAPTER.length

export const chapterCount = (book: number): number =>
  VERSES_PER_CHAPTER[book - 1]?.length ?? 0

export const verseCount = (book: number, chapter: number): number =>
  VERSES_PER_CHAPTER[book - 1]?.[chapter - 1] ?? 0

export const isValidVerseId = (verseId: number): boolean => {
  const { book, chapter, verse } = decodeVerseId(verseId)
  return verse >= 1 && verse <= verseCount(book, chapter)
}

const chapterStartOrdinals = (): {
  byChapter: number[][]
  total: number
} => {
  const byChapter: number[][] = []
  let total = 0
  for (const chapters of VERSES_PER_CHAPTER) {
    const chapterStarts: number[] = []
    for (const verses of chapters) {
      chapterStarts.push(total)
      total += verses
    }
    byChapter.push(chapterStarts)
  }
  return { byChapter, total }
}

const { byChapter: ordinalOfChapterStart, total: canonVerseCount } =
  chapterStartOrdinals()

export const CANON_VERSE_COUNT = canonVerseCount

export const verseIdToOrdinal = (verseId: number): number | null => {
  if (!isValidVerseId(verseId)) return null
  const { book, chapter, verse } = decodeVerseId(verseId)
  return ordinalOfChapterStart[book - 1][chapter - 1] + verse - 1
}

export const ordinalToVerseId = (ordinal: number): number | null => {
  if (ordinal < 0 || ordinal >= CANON_VERSE_COUNT) return null
  for (let book = BOOK_COUNT; book >= 1; book--) {
    const chapterStarts = ordinalOfChapterStart[book - 1]
    if (chapterStarts[0] > ordinal) continue
    for (let chapter = chapterStarts.length; chapter >= 1; chapter--) {
      const start = chapterStarts[chapter - 1]
      if (start <= ordinal) {
        return makeVerseId(book, chapter, ordinal - start + 1)
      }
    }
  }
  return null
}

export const nextVerse = (verseId: number): number | null => {
  if (!isValidVerseId(verseId)) return null
  const { book, chapter, verse } = decodeVerseId(verseId)
  if (verse < verseCount(book, chapter)) {
    return makeVerseId(book, chapter, verse + 1)
  }
  if (chapter < chapterCount(book)) return makeVerseId(book, chapter + 1, 1)
  if (book < BOOK_COUNT) return makeVerseId(book + 1, 1, 1)
  return null
}
