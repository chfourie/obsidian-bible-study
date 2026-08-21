// Hangs the parsed ref spans off the atoms they belong to, with the shared
// overrides ledger standing behind the citations the scanner cannot carry on
// its own (spec-books §8).

import type { RefSpan } from '../../src/modules/verse-content'
import { OverrideLedger, type RefOverrides } from '../book-pipeline/ref-overrides'
import { parseReference } from '../../src/reference/parse-reference'
import { makeVerseId } from '../../src/reference/verse-id'
import type { VerseRange } from '../../src/reference/verse-range'
import type { Epigraph, ParsedSection } from './parse-humility-text'
import {
  parseAttributionRefSpans,
  parseParagraphRefSpans,
  unresolvedAttribution,
  unresolvedCitations,
} from './parse-ref-spans'

const NOTE_SECTION = /^Note ([A-Z])$/

const scriptureRanges = (reference: string): VerseRange[] => {
  const parsed = parseReference(reference)
  if (parsed === null)
    throw new Error(`Fix override cites an unreadable reference: ${reference}`)
  return parsed.reference.ranges
}

const noteRangesOf = (
  book: number,
  sections: readonly ParsedSection[],
): Map<string, VerseRange> =>
  new Map(
    sections.flatMap((section) => {
      const note = NOTE_SECTION.exec(section.name)
      if (note === null) return []
      return [
        [
          note[1],
          {
            startId: makeVerseId(book, section.chapter, 1),
            endId: makeVerseId(book, section.chapter, section.paragraphs.length),
          },
        ] as [string, VerseRange],
      ]
    }),
  )

const withRefs = <Atom extends { refs?: RefSpan[] }>(
  atom: Atom,
  refs: RefSpan[],
): Atom => (refs.length === 0 ? atom : { ...atom, refs })

export const attachRefSpans = (
  book: number,
  sections: readonly ParsedSection[],
  overrides: RefOverrides,
): ParsedSection[] => {
  const ledger = new OverrideLedger(
    { fix: overrides.fix ?? [], suppress: overrides.suppress ?? [] },
    scriptureRanges,
  )
  const noteRanges = noteRangesOf(book, sections)
  const attached = sections.map((section) => {
    const paragraphs = section.paragraphs.map((paragraph, index) => {
      const at = `${section.chapter}.${index + 1}`
      const { refs, accounted } = ledger.apply(
        at,
        paragraph.text,
        parseParagraphRefSpans(paragraph.text, noteRanges),
      )
      const unresolved = unresolvedCitations(paragraph.text, accounted)
      if (unresolved.length > 0)
        throw new Error(
          `Unresolved citation at ${at}: ${unresolved.join(' ')} — ` +
            'add a fix or suppress entry to the ref overrides file',
        )
      return withRefs(paragraph, refs)
    })
    if (section.epigraphs === undefined) return { ...section, paragraphs }
    const epigraphs = section.epigraphs.map((epigraph, index) => {
      const at = `${section.chapter}.e${index + 1}`
      const { refs, accounted } = ledger.apply(
        at,
        epigraph.attribution,
        parseAttributionRefSpans(epigraph.attribution),
      )
      const unresolved = unresolvedAttribution(epigraph.attribution, accounted)
      if (unresolved !== null)
        throw new Error(
          `Unresolved epigraph citation at ${at}: ${unresolved} — ` +
            'add a fix entry to the ref overrides file',
        )
      return withRefs<Epigraph>(epigraph, refs)
    })
    return { ...section, paragraphs, epigraphs }
  })
  ledger.assertAllUsed()
  return attached
}

export { parseRefOverrides, type RefOverrides } from '../book-pipeline/ref-overrides'
