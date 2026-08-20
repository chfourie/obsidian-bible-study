import { VERSES_PER_CHAPTER } from './versification-data'
import { decodeVerseId, makeVerseId } from './verse-id'

export const BOOK_COUNT = VERSES_PER_CHAPTER.length

export type BookSectionCounts = {
  chapter: number
  paragraphs: number
}

export type BookVersification = {
  book: number
  sections: readonly BookSectionCounts[]
}

type VersificationTable = {
  firstChapter: number
  atomsPerChapter: readonly number[]
}

const CANON_TABLES: readonly VersificationTable[] = VERSES_PER_CHAPTER.map(
  (atomsPerChapter) => ({ firstChapter: 1, atomsPerChapter }),
)

const registeredBooks = new Map<number, VersificationTable>()

const tableFor = (book: number): VersificationTable | undefined =>
  CANON_TABLES[book - 1] ?? registeredBooks.get(book)

const rejectRegistration = (book: number, reason: string): never => {
  throw new Error(`Cannot register versification for book ${book}: ${reason}`)
}

const toValidatedTable = ({
  book,
  sections,
}: BookVersification): VersificationTable => {
  if (!Number.isInteger(book) || book <= BOOK_COUNT) {
    rejectRegistration(book, 'the compiled canon owns book numbers 1-66')
  }
  if (sections.length === 0) rejectRegistration(book, 'the table is empty')
  const firstChapter = sections[0].chapter
  if (!Number.isInteger(firstChapter) || firstChapter < 0) {
    rejectRegistration(book, `section ${firstChapter} is not a chapter number`)
  }
  sections.forEach(({ chapter, paragraphs }, index) => {
    if (chapter !== firstChapter + index) {
      rejectRegistration(book, `section ${chapter} breaks reading order`)
    }
    if (!Number.isInteger(paragraphs) || paragraphs < 1) {
      rejectRegistration(
        book,
        `section ${chapter} has ${paragraphs} paragraphs`,
      )
    }
  })
  return {
    firstChapter,
    atomsPerChapter: sections.map(({ paragraphs }) => paragraphs),
  }
}

export const registerBookVersification = (
  versification: BookVersification,
): void => {
  registeredBooks.set(versification.book, toValidatedTable(versification))
}

export const deregisterBookVersification = (book: number): void => {
  registeredBooks.delete(book)
}

export const chapterCount = (book: number): number =>
  tableFor(book)?.atomsPerChapter.length ?? 0

export const verseCount = (book: number, chapter: number): number => {
  const table = tableFor(book)
  if (!table) return 0
  return table.atomsPerChapter[chapter - table.firstChapter] ?? 0
}

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

const isCanonBook = (book: number): boolean => book >= 1 && book <= BOOK_COUNT

export const verseIdToOrdinal = (verseId: number): number | null => {
  const { book, chapter, verse } = decodeVerseId(verseId)
  if (!isCanonBook(book) || !isValidVerseId(verseId)) return null
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
  const table = tableFor(book)
  if (!table) return null
  const lastChapter = table.firstChapter + table.atomsPerChapter.length - 1
  if (chapter < lastChapter) return makeVerseId(book, chapter + 1, 1)
  if (isCanonBook(book) && book < BOOK_COUNT) return makeVerseId(book + 1, 1, 1)
  return null
}
