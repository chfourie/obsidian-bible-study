import { makeVerseId } from '../reference'

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

export type BookContent = Record<number, string>

export type NormalizedModule = {
  books: Map<number, BookContent>
}

export type SourceInfo = {
  source: string
  sourceChecksum: string
}

export const normalizeGetBibleTranslation = (
  translation: GetBibleTranslation,
  _sourceInfo: SourceInfo,
): NormalizedModule => {
  const books = new Map<number, BookContent>()
  for (const book of translation.books) {
    const content: BookContent = {}
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        content[makeVerseId(book.nr, verse.chapter, verse.verse)] =
          verse.text.trim()
      }
    }
    books.set(book.nr, content)
  }
  return { books }
}
