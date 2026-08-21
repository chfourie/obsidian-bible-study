// The generic book pipeline's entry point: a curated Markdown source plus the
// Book Registry and that book's ref overrides become a publishable module
// artifact. Pure — every input is a value, so the whole grid is assertable in
// a test without touching a file the build writes.

import { createHash } from 'node:crypto'
import { MODULE_FORMAT_VERSION } from '../../src/modules/module-manifest'
import type { RefSpan } from '../../src/modules/verse-content'
import { decodeVerseId, makeVerseId } from '../../src/reference/verse-id'
import { parseReference } from '../../src/reference/parse-reference'
import type { VerseRange } from '../../src/reference/verse-range'
import {
  bookPublication,
  type BookRegistryEntry,
} from './book-registry'
import {
  type BookParagraph,
  type Epigraph,
  parseBookMarkdown,
} from './parse-book-markdown'
import { scanBookRefSpans, sectionRangesOf } from './parse-book-refs'
import { OverrideLedger, type RefOverrides } from './ref-overrides'

export type BookSection = {
  chapter: number
  name: string
  named?: true
  paragraphs: number
}

export type BookManifestData = {
  number: number
  editionCode: string
  author: string
  year: number
  abbreviation: string
  aliases: string[]
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

// The atom as it is published: headings stay out of the artifact until
// ticket #95 gives them a place in the format.
export type PublishedParagraph = Omit<BookParagraph, 'headings'>

export type BookArtifact = {
  manifest: BookArtifactManifest
  books: Record<number, Record<number, PublishedParagraph>>
  epigraphs: Record<number, Epigraph[]>
}

const withRefs = <Atom extends { refs?: RefSpan[] }>(
  atom: Atom,
  refs: RefSpan[],
): Atom => (refs.length === 0 ? atom : { ...atom, refs })

const scriptureRanges = (reference: string): VerseRange[] => {
  const parsed = parseReference(reference)
  if (parsed === null)
    throw new Error(`Fix override cites an unreadable reference: ${reference}`)
  return parsed.reference.ranges
}

export const buildBookArtifact = (
  markdown: string,
  registry: readonly BookRegistryEntry[],
  refOverrides: RefOverrides = {},
): BookArtifact => {
  const { moduleId, language, sections } = parseBookMarkdown(markdown)
  const publication = bookPublication(registry, moduleId)
  const book = publication.bookNumber

  const sectionRanges = sectionRangesOf(book, sections)
  const ledger = new OverrideLedger(
    { fix: refOverrides.fix ?? [], suppress: refOverrides.suppress ?? [] },
    scriptureRanges,
  )

  const attach = <Atom extends { refs?: RefSpan[] }>(
    at: string,
    text: string,
    atom: Atom,
  ): Atom => {
    const scanned = scanBookRefSpans(text, sectionRanges)
    const { refs, accounted } = ledger.apply(at, text, scanned.spans)
    const unresolved = scanned.unresolved.filter(
      (citation) =>
        !accounted.some(
          (span) => text.slice(span.start, span.end) === citation,
        ),
    )
    if (unresolved.length > 0)
      throw new Error(
        `Unresolved citation at ${at}: ${unresolved.join(' ')} — ` +
          'add a fix or suppress entry to the ref overrides file',
      )
    return withRefs(atom, refs)
  }

  const paragraphs: Record<number, PublishedParagraph> = {}
  const epigraphs: Record<number, Epigraph[]> = {}
  for (const section of sections) {
    section.paragraphs.forEach(({ headings: _headings, ...paragraph }, index) => {
      const at = `${section.chapter}.${index + 1}`
      paragraphs[makeVerseId(book, section.chapter, index + 1)] = attach(
        at,
        paragraph.text,
        paragraph,
      )
    })
    if (section.epigraphs === undefined) continue
    epigraphs[section.chapter] = section.epigraphs.map((epigraph, index) =>
      attach(
        `${section.chapter}.e${index + 1}`,
        epigraph.attribution,
        epigraph,
      ),
    )
  }
  ledger.assertAllUsed()

  return {
    manifest: {
      id: publication.moduleId,
      name: publication.title,
      language,
      license: publication.license,
      formatVersion: MODULE_FORMAT_VERSION,
      kind: 'book',
      capabilities: { strongsTagged: false },
      book: {
        number: book,
        editionCode: publication.editionCode,
        author: publication.author,
        year: publication.year,
        abbreviation: publication.abbreviation,
        aliases: publication.aliases,
        sections: sections.map((section) => ({
          chapter: section.chapter,
          name: section.name,
          ...(section.named === true ? { named: true as const } : {}),
          paragraphs: section.paragraphs.length,
        })),
      },
    },
    books: { [book]: paragraphs },
    epigraphs,
  }
}

// How many live citations each section came out with — the build's own report
// on what the refs channel picked up (spec-books §8).
export const refSpanCounts = (artifact: BookArtifact): Map<number, number> => {
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
  for (const [chapter, sectionEpigraphs] of Object.entries(artifact.epigraphs))
    for (const epigraph of sectionEpigraphs)
      add(Number(chapter), epigraph.refs?.length ?? 0)
  return counts
}

export const sha256Hex = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex')

export { parseBookRegistry } from './book-registry'
export { parseRefOverrides } from './ref-overrides'
