import { VERSES_PER_CHAPTER } from './versification-data'

export const BOOK_COUNT = VERSES_PER_CHAPTER.length

export const chapterCount = (book: number): number =>
  VERSES_PER_CHAPTER[book - 1]?.length ?? 0

export const verseCount = (book: number, chapter: number): number =>
  VERSES_PER_CHAPTER[book - 1]?.[chapter - 1] ?? 0
