import { BOOK_COUNT, isValidVerseId, makeVerseId } from '../reference'
import {
  MODULE_FORMAT_VERSION,
  type ModuleManifest,
} from './module-manifest'
import type { VerseContent } from './verse-content'

export type GetBibleVerse = {
  chapter: number
  verse: number
  name: string
  text: string
}

export type GetBibleChapter = {
  chapter: number
  name: string
  verses: GetBibleVerse[]
}

export type GetBibleBook = {
  nr: number
  name: string
  chapters: GetBibleChapter[]
}

export type GetBibleTranslation = {
  translation: string
  abbreviation: string
  lang: string
  language: string
  distribution_license: string
  books: GetBibleBook[]
}

export type BookContent = Record<number, VerseContent>

export type NormalizedModule = {
  manifest: ModuleManifest
  books: Map<number, BookContent>
}

export type SourceInfo = {
  source: string
  sourceChecksum: string
}

const fitsBcvDigits = (value: number): boolean =>
  Number.isInteger(value) && value >= 1 && value <= 999

export const normalizeGetBibleTranslation = (
  moduleId: string,
  translation: GetBibleTranslation,
  sourceInfo: SourceInfo,
): NormalizedModule => {
  const books = new Map<number, BookContent>()
  for (const book of translation.books) {
    if (book.nr < 1 || book.nr > BOOK_COUNT) continue
    const content: BookContent = {}
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        if (!fitsBcvDigits(verse.chapter) || !fitsBcvDigits(verse.verse))
          continue
        const verseId = makeVerseId(book.nr, verse.chapter, verse.verse)
        if (isValidVerseId(verseId)) content[verseId] = verse.text.trim()
      }
    }
    books.set(book.nr, content)
  }
  return {
    manifest: {
      id: moduleId,
      name: translation.translation,
      language: translation.language,
      license: translation.distribution_license,
      source: sourceInfo.source,
      sourceChecksum: sourceInfo.sourceChecksum,
      formatVersion: MODULE_FORMAT_VERSION,
      capabilities: { strongsTagged: false },
    },
    books,
  }
}
