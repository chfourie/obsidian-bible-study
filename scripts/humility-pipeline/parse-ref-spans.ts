// Murray cites scripture in one uniform shape — a book name, a roman-numeral
// chapter and arabic verses, bracketed in the prose or trailing a chapter
// epigraph. That regularity is what lets the build turn his citations into
// ref spans without hand-annotating anything (spec-books §8). Anything the
// scanner cannot resolve is reported rather than dropped, so a mangled or
// unusual citation reaches the overrides file instead of vanishing.

import type { RefSpan } from '../../src/modules/verse-content'
import { bookIdForName } from '../../src/reference/books'
import { makeVerseId } from '../../src/reference/verse-id'
import { mergeRanges, type VerseRange } from '../../src/reference/verse-range'
import { verseCount } from '../../src/reference/versification'

const BRACKETED = /\(([^)]*)\)/g
const NOTE_POINTER = /See Note ([A-Z])\./g
const IS_NOTE_POINTER = /See Note [A-Z]\./

// A book name (optionally preceded by its ordinal), a roman-numeral chapter
// whose period the transcription sometimes drops, then arabic verses as a
// hyphenated range, a comma list, or a single number. The book is optional so
// a second chapter of the same book can follow a comma bare.
const CITATION =
  /(?:([1-3]\s+)?([A-Za-z]+)\.?\s+)?([ivxlcdm]+)\.?\s+(\d+(?:\s*-\s*\d+)?(?:\s*,\s*\d+(?:\s*-\s*\d+)?)*)/gi

const ROMAN =
  /^m*(?:c[md]|d?c{0,3})(?:x[cl]|l?x{0,3})(?:i[xv]|v?i{0,3})$/i

const ROMAN_DIGITS: Record<string, number> = {
  i: 1,
  v: 5,
  x: 10,
  l: 50,
  c: 100,
  d: 500,
  m: 1000,
}

const romanValue = (numeral: string): number | null => {
  if (!ROMAN.test(numeral)) return null
  const digits = [...numeral.toLowerCase()].map((digit) => ROMAN_DIGITS[digit])
  return digits.reduce(
    (total, value, index) =>
      total + (digits[index + 1] > value ? -value : value),
    0,
  )
}

// Every verse named must exist on the target book's grid; a citation naming
// one that does not is mangled, and stays unresolved for the build to report.
const versesToRanges = (
  book: number,
  chapter: number,
  verses: string,
): VerseRange[] | null => {
  const lastVerse = verseCount(book, chapter)
  if (lastVerse === 0) return null
  const ranges: VerseRange[] = []
  for (const part of verses.split(',')) {
    const [from, to = from] = part.split('-').map((number) => Number(number))
    if (from < 1 || to < from || to > lastVerse) return null
    ranges.push({
      startId: makeVerseId(book, chapter, from),
      endId: makeVerseId(book, chapter, to),
    })
  }
  return mergeRanges(ranges)
}

const scanCitations = (body: string, offset: number): RefSpan[] => {
  const spans: RefSpan[] = []
  // The book of the last citation resolved here, so `xviii. 13` following
  // `LUKE xiv. 11,` stays in Luke.
  let carriedBook: number | null = null
  for (const match of body.matchAll(CITATION)) {
    const [text, ordinal, name, numeral, verses] = match
    const book: number | null =
      name === undefined
        ? carriedBook
        : bookIdForName(`${ordinal ?? ''}${name}`)
    const chapter = romanValue(numeral)
    const ranges =
      book === null || chapter === null
        ? null
        : versesToRanges(book, chapter, verses)
    if (ranges === null) {
      carriedBook = null
      continue
    }
    carriedBook = book
    spans.push({
      start: offset + match.index,
      end: offset + match.index + text.length,
      ranges,
    })
  }
  return spans
}

export const parseParagraphRefSpans = (
  text: string,
  noteRanges: ReadonlyMap<string, VerseRange>,
): RefSpan[] => {
  const spans: RefSpan[] = []
  for (const bracket of text.matchAll(BRACKETED)) {
    const body = bracket[1]
    const offset = bracket.index + 1
    for (const pointer of body.matchAll(NOTE_POINTER)) {
      const range = noteRanges.get(pointer[1])
      if (range === undefined) continue
      spans.push({
        start: offset + pointer.index,
        end: offset + pointer.index + pointer[0].length,
        ranges: [range],
      })
    }
    spans.push(...scanCitations(body, offset))
  }
  return spans.sort((a, b) => a.start - b.start)
}

export const parseAttributionRefSpans = (text: string): RefSpan[] =>
  scanCitations(text, 0)

// Whether a string opens the way a citation does — the test that separates a
// citation the scanner failed on from an ordinary bracketed aside.
const citationShaped = (body: string): boolean => {
  if (IS_NOTE_POINTER.test(body)) return true
  const words = body.trim().split(/\s+/)
  const lead = /^[1-3]$/.test(words[0])
    ? words.slice(0, 2).join(' ')
    : words[0]
  return bookIdForName(lead) !== null
}

const covered = (spans: readonly RefSpan[], start: number, end: number): boolean =>
  spans.some((span) => span.start < end && start < span.end)

export const unresolvedCitations = (
  text: string,
  spans: readonly RefSpan[],
): string[] => {
  const unresolved: string[] = []
  for (const bracket of text.matchAll(BRACKETED)) {
    const start = bracket.index + 1
    if (covered(spans, start, start + bracket[1].length)) continue
    if (!citationShaped(bracket[1])) continue
    unresolved.push(bracket[0])
  }
  return unresolved
}

export const unresolvedAttribution = (
  text: string,
  spans: readonly RefSpan[],
): string | null =>
  spans.length === 0 && citationShaped(text) ? text : null
