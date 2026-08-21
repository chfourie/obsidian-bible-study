import { createHash } from 'node:crypto'
import { MODULE_FORMAT_VERSION } from '../../src/modules/module-manifest'
import { decodeVerseId, makeVerseId } from '../../src/reference/verse-id'
import { type BookRegistryEntry, assertRegisteredBook } from '../book-pipeline/book-registry'
import { attachRefSpans, type RefOverrides } from './attach-ref-spans'
import {
  type BookParagraph,
  type Epigraph,
  parseHumilityText,
} from './parse-humility-text'

export const HUMILITY_MODULE_ID = 'hum-m1895'
export const HUMILITY_BOOK_NUMBER = 101
const HUMILITY_TITLE = 'Humility'
const HUMILITY_AUTHOR = 'Andrew Murray'
const HUMILITY_EDITION_CODE = 'HUM-M1895'
const HUMILITY_YEAR = 1895

export type BookSection = {
  chapter: number
  name: string
  paragraphs: number
}

export type BookManifestData = {
  number: number
  editionCode: string
  author: string
  year: number
  abbreviation: string
  sections: BookSection[]
}

export type BookArtifactManifest = {
  id: string
  name: string
  language: string
  license: string
  formatVersion: number
  kind: 'book'
  capabilities: { strongsTagged: false }
  book: BookManifestData
}

export type HumilityArtifact = {
  manifest: BookArtifactManifest
  books: Record<number, Record<number, BookParagraph>>
  epigraphs: Record<number, Epigraph[]>
}

export const buildHumilityArtifact = (
  gutenbergText: string,
  registry: BookRegistryEntry[],
  refOverrides: RefOverrides = {},
): HumilityArtifact => {
  const sections = attachRefSpans(
    HUMILITY_BOOK_NUMBER,
    parseHumilityText(gutenbergText),
    refOverrides,
  )

  assertRegisteredBook(
    {
      bookNumber: HUMILITY_BOOK_NUMBER,
      title: HUMILITY_TITLE,
      author: HUMILITY_AUTHOR,
      moduleId: HUMILITY_MODULE_ID,
      editionCode: HUMILITY_EDITION_CODE,
    },
    registry,
  )

  const paragraphs = Object.fromEntries(
    sections.flatMap((section) =>
      section.paragraphs.map((paragraph, index) => [
        makeVerseId(HUMILITY_BOOK_NUMBER, section.chapter, index + 1),
        paragraph,
      ]),
    ),
  )

  const epigraphs: Record<number, Epigraph[]> = {}
  for (const section of sections)
    if (section.epigraphs !== undefined)
      epigraphs[section.chapter] = section.epigraphs

  return {
    manifest: {
      id: HUMILITY_MODULE_ID,
      name: HUMILITY_TITLE,
      language: 'English',
      license: 'Public Domain',
      formatVersion: MODULE_FORMAT_VERSION,
      kind: 'book',
      capabilities: { strongsTagged: false },
      book: {
        number: HUMILITY_BOOK_NUMBER,
        editionCode: HUMILITY_EDITION_CODE,
        author: HUMILITY_AUTHOR,
        year: HUMILITY_YEAR,
        abbreviation: 'Hum',
        sections: sections.map((section) => ({
          chapter: section.chapter,
          name: section.name,
          ...(section.named === true ? { named: true } : {}),
          paragraphs: section.paragraphs.length,
        })),
      },
    },
    books: { [HUMILITY_BOOK_NUMBER]: paragraphs },
    epigraphs,
  }
}

// How many live citations each section came out with — the build's own
// report on what the refs channel picked up (spec-books §8).
export const refSpanCounts = (
  artifact: HumilityArtifact,
): Map<number, number> => {
  const counts = new Map<number, number>(
    artifact.manifest.book.sections.map((section) => [section.chapter, 0]),
  )
  const add = (chapter: number, spans: number): void => {
    counts.set(chapter, (counts.get(chapter) ?? 0) + spans)
  }
  for (const [verseId, paragraph] of Object.entries(
    artifact.books[artifact.manifest.book.number],
  ))
    add(decodeVerseId(Number(verseId)).chapter, paragraph.refs?.length ?? 0)
  for (const [chapter, epigraphs] of Object.entries(artifact.epigraphs))
    for (const epigraph of epigraphs)
      add(Number(chapter), epigraph.refs?.length ?? 0)
  return counts
}

export const sha256Hex = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex')

export { parseBookRegistry } from '../book-pipeline/book-registry'
export { parseRefOverrides } from './attach-ref-spans'
