import { BOOK_COUNT, isValidVerseId, makeVerseId } from '../reference'
import { MODULE_FORMAT_VERSION } from './module-manifest'
import type {
  BookContent,
  NormalizedModule,
  SourceInfo,
} from './normalize-getbible-translation'

export type BollsVerse = {
  pk?: number
  translation?: string
  book: number
  chapter: number
  verse: number
  text: string
  comment?: string
}

export type BollsTranslationMeta = {
  name: string
  language: string
  license?: string
}

const plainText = (raw: string): string =>
  raw
    .replace(/<sup>.*?<\/sup>/gs, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const fitsBcvDigits = (value: number): boolean =>
  Number.isInteger(value) && value >= 1 && value <= 999

export const normalizeBollsTranslation = (
  moduleId: string,
  verses: BollsVerse[],
  meta: BollsTranslationMeta,
  sourceInfo: SourceInfo,
): NormalizedModule => {
  const books = new Map<number, BookContent>()
  for (const verse of verses) {
    if (verse.book < 1 || verse.book > BOOK_COUNT) continue
    if (!fitsBcvDigits(verse.chapter) || !fitsBcvDigits(verse.verse)) continue
    const verseId = makeVerseId(verse.book, verse.chapter, verse.verse)
    if (!isValidVerseId(verseId)) continue
    const content = books.get(verse.book) ?? {}
    content[verseId] = plainText(verse.text)
    books.set(verse.book, content)
  }
  return {
    manifest: {
      id: moduleId,
      name: meta.name,
      language: meta.language,
      license: meta.license ?? '',
      source: sourceInfo.source,
      sourceChecksum: sourceInfo.sourceChecksum,
      formatVersion: MODULE_FORMAT_VERSION,
      capabilities: { strongsTagged: false },
    },
    books,
  }
}
