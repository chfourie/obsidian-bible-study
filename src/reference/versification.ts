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
