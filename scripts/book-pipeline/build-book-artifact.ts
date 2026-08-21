// The generic book pipeline's entry point: a curated Markdown source plus the
// Book Registry and that book's ref overrides become a publishable module
// artifact. Pure — every input is a value, so the whole grid is assertable in
// a test without touching a file the build writes.

import { createHash } from 'node:crypto'
import { BOOK_MODULE_FORMAT_VERSION } from '../../src/modules/module-manifest'
import type { RefSpan } from '../../src/modules/verse-content'
import { decodeVerseId, makeVerseId } from '../../src/reference/verse-id'
import {
  bookPublication,
  type BookRegistryEntry,
} from './book-registry'
import {
  type BookParagraph,
  type Epigraph,
  type ParsedBookSection,
  parseBookMarkdown,
} from './parse-book-markdown'
import { scanBookRefSpans, sectionRangesOf } from './parse-book-refs'
import { OverrideLedger, type RefOverrides } from './ref-overrides'

export type BookSection = {
  chapter: number
  name: string
  named?: true
  paragraphs: number
  part?: string
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

export type BookArtifact = {
  manifest: BookArtifactManifest
  books: Record<number, Record<number, BookParagraph>>
  epigraphs: Record<number, Epigraph[]>
}

// The Part a section sits under runs on from the part-level Heading that
// opened it until the next one — the picker's group labels, resolved once at
// build time so the reader needs only the section table to draw them. Front
// and back matter stand outside the Parts, as the printed work has them.
const sectionTable = (sections: ParsedBookSection[]): BookSection[] => {
  let part: string | undefined
  return sections.map((section) => {
    const opening = section.paragraphs[0]?.headings?.find(
      (heading) => heading.level === 'part',
    )
    if (opening !== undefined) part = opening.text
    const named = section.named === true
    return {
      chapter: section.chapter,
      name: section.name,
      ...(named ? { named: true as const } : {}),
      paragraphs: section.paragraphs.length,
      ...(part === undefined || named ? {} : { part }),
    }
  })
}

const withRefs = <Atom extends { refs?: RefSpan[] }>(
  atom: Atom,
  refs: RefSpan[],
): Atom => (refs.length === 0 ? atom : { ...atom, refs })

export const buildBookArtifact = (
  markdown: string,
  registry: readonly BookRegistryEntry[],
  refOverrides: RefOverrides = {},
): BookArtifact => {
  const { moduleId, language, sections } = parseBookMarkdown(markdown)
  const publication = bookPublication(registry, moduleId)
  const book = publication.bookNumber

  const sectionRanges = sectionRangesOf(book, sections)
  const ledger = new OverrideLedger({
    fix: refOverrides.fix ?? [],
    suppress: refOverrides.suppress ?? [],
  })

  // Collected rather than thrown on, so one pass over a fresh source lists
  // every unresolved citation instead of one per rebuild.
  const unresolved: string[] = []
  const attach = <Atom extends { refs?: RefSpan[] }>(
    at: string,
    text: string,
    atom: Atom,
  ): Atom => {
    const scanned = scanBookRefSpans(text, sectionRanges)
    const { refs, accounted } = ledger.apply(at, text, scanned.spans)
    for (const citation of scanned.unresolved)
      if (
        !accounted.some((span) => text.slice(span.start, span.end) === citation)
      )
        unresolved.push(`${at}: ${citation}`)
    return withRefs(atom, refs)
  }

  const paragraphs: Record<number, BookParagraph> = {}
  const epigraphs: Record<number, Epigraph[]> = {}
  for (const section of sections) {
    section.paragraphs.forEach((paragraph, index) => {
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
  if (unresolved.length > 0)
    throw new Error(
      `Unresolved citations — add a fix or suppress entry to the ref ` +
        `overrides file for each:\n  ${unresolved.join('\n  ')}`,
    )
  ledger.assertAllUsed()

  return {
    manifest: {
      id: publication.moduleId,
      name: publication.title,
      language,
      license: publication.license,
      formatVersion: BOOK_MODULE_FORMAT_VERSION,
      kind: 'book',
      capabilities: { strongsTagged: false },
      book: {
        number: book,
        editionCode: publication.editionCode,
        author: publication.author,
        year: publication.year,
        abbreviation: publication.abbreviation,
        aliases: publication.aliases,
        sections: sectionTable(sections),
      },
    },
    books: { [book]: paragraphs },
    epigraphs,
  }
}

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

export const sha256Hex = (data: string | Uint8Array): string =>
  typeof data === 'string'
    ? createHash('sha256').update(data, 'utf8').digest('hex')
    : createHash('sha256').update(data).digest('hex')

export { parseBookRegistry } from './book-registry'
export { parseRefOverrides } from './ref-overrides'
