// Finds the live citations inside a modern book's prose (spec-books §8).
// Where Murray writes roman-numeral chapters in brackets, a contemporary
// author writes plain `Book 3:16` in the running text, so the scanner works
// over the whole atom rather than only what is parenthesised. Only explicit
// citations become spans — an allusion the author did not cite stays prose.

import type { RefSpan } from '../../src/modules/verse-content'
import { parseReference } from '../../src/reference/parse-reference'
import { makeVerseId } from '../../src/reference/verse-id'
import type { VerseRange } from '../../src/reference/verse-range'
import type { ParsedBookSection } from './parse-book-markdown'

// A book name (optionally preceded by its ordinal and abbreviated with a
// period), then arabic chapter:verse with the author's own list punctuation:
// `&`, `,` and `;` continue one citation, while `and` starts a fresh one.
const SCRIPTURE_CITATION =
  /(?:\b([1-3])\s+)?\b([A-Z][A-Za-z]+)\.?\s+(\d+:\d+(?:\s*[-–]\s*\d+)?(?:\s*[,&;]\s*\d+(?::\d+)?(?:\s*[-–]\s*\d+)?)*)/g

// The author's own cross-walks: a printed chapter number, a named back-matter
// section, or a sub-section head standing for the chapter that holds it.
const SELF_CITATION = /\b(Chapter\s+\d+|Appendix\s+[A-Z])\b/g
const SUB_SECTION_CITATION = /\b(\d{1,2})\.\d(?:\.\d)?\b/g

export type SectionRanges = ReadonlyMap<string, VerseRange>

export type ScannedRefs = {
  spans: RefSpan[]
  // Citation-shaped text the scanner resolved nothing in — reported so it
  // reaches the overrides file instead of silently vanishing.
  unresolved: string[]
}

// Every label the book's own sections answer to, so a cross-walk resolves
// without the book being registered at build time.
export const sectionRangesOf = (
  book: number,
  sections: readonly ParsedBookSection[],
): SectionRanges => {
  const ranges = new Map<string, VerseRange>()
  for (const section of sections) {
    if (section.paragraphs.length === 0) continue
    const range: VerseRange = {
      startId: makeVerseId(book, section.chapter, 1),
      endId: makeVerseId(book, section.chapter, section.paragraphs.length),
    }
    ranges.set(`chapter ${section.chapter}`, range)
    ranges.set(section.name.toLowerCase(), range)
  }
  return ranges
}

// The author's list punctuation reduced to the one separator the reference
// grammar reads, so the shared parser can do the arithmetic.
const normalizeSpec = (spec: string): string =>
  spec.replace(/–/g, '-').replace(/[;&]/g, ',').replace(/\s+/g, '')

const scriptureRanges = (
  ordinal: string | undefined,
  name: string,
  spec: string,
): VerseRange[] | null => {
  const parsed = parseReference(
    `${ordinal === undefined ? '' : `${ordinal} `}${name} ${normalizeSpec(spec)}`,
  )
  return parsed === null || parsed.invalidTokens.length > 0
    ? null
    : parsed.reference.ranges
}

export const scanBookRefSpans = (
  text: string,
  sectionRanges: SectionRanges,
): ScannedRefs => {
  const spans: RefSpan[] = []
  const unresolved: string[] = []

  for (const match of text.matchAll(SCRIPTURE_CITATION)) {
    const [citation, ordinal, name, spec] = match
    const ranges = scriptureRanges(ordinal, name, spec)
    if (ranges === null) unresolved.push(citation)
    else spans.push({ start: match.index, end: match.index + citation.length, ranges })
  }

  const covered = (start: number): boolean =>
    spans.some((span) => span.start <= start && start < span.end)

  for (const match of text.matchAll(SELF_CITATION)) {
    if (covered(match.index)) continue
    const range = sectionRanges.get(match[1].replace(/\s+/g, ' ').toLowerCase())
    if (range === undefined) unresolved.push(match[1])
    else
      spans.push({
        start: match.index,
        end: match.index + match[1].length,
        ranges: [range],
      })
  }

  for (const match of text.matchAll(SUB_SECTION_CITATION)) {
    if (covered(match.index)) continue
    const range = sectionRanges.get(`chapter ${Number(match[1])}`)
    if (range === undefined) continue
    spans.push({
      start: match.index,
      end: match.index + match[0].length,
      ranges: [range],
    })
  }

  return { spans: spans.sort((a, b) => a.start - b.start), unresolved }
}
