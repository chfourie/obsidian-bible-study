import { decodeVerseId } from '../reference'
import type { BookContent } from './normalized-module'
import type { FormatSpan, VerseContent } from './verse-content'
import { verseTagsOf } from './verse-content'

// One verse's share of a family's occurrences: the count is how many words of
// that verse the family is tagged on, which is what a concordance counts.
export type VerseOccurrences = { verseId: number; count: number }

// A verse holding a single occurrence — the overwhelming majority — is stored
// as its bare verse id, and only a verse holding more pays for a pair. H3068
// alone runs to thousands of entries, so the compact case decides the size of
// the whole index.
export type ConcordanceEntry = number | [verseId: number, count: number]

// One Tagged Translation's concordance: every Strong's Family it tags, against
// the verses it tags them in, ascending, with each verse's occurrence count.
// No renderings — the words of each occurrence are re-derived from that verse's
// own tag spans, so the index stays small enough to hold whole and never drifts
// from the text.
export type ConcordanceIndex = Record<string, ConcordanceEntry[]>

// Bumped whenever the derivation changes what a stored index should say, so an
// index built by an older plugin is rebuilt in place. v2: occurrence counts.
export const CONCORDANCE_INDEX_VERSION = 2

const FAMILY = /^([HG]\d+)[A-Za-z]*$/

// Occurrence matching is only honest at family granularity: tagged
// translations mostly predate the lettered disambiguations, so an extended
// number in either the tagging or the lookup answers under its family.
export const strongsFamily = (strongsNumber: string): string =>
  FAMILY.exec(strongsNumber)?.[1] ?? strongsNumber

// A v1 index stored bare verse ids, each of which was one occurrence — which
// is exactly what a bare entry still means.
const decodeEntry = (entry: ConcordanceEntry): VerseOccurrences =>
  typeof entry === 'number'
    ? { verseId: entry, count: 1 }
    : { verseId: entry[0], count: entry[1] }

const encodeEntry = ({ verseId, count }: VerseOccurrences): ConcordanceEntry =>
  count === 1 ? verseId : [verseId, count]

export const occurrencesOf = (
  index: ConcordanceIndex,
  strongsNumber: string,
): VerseOccurrences[] =>
  (index[strongsFamily(strongsNumber)] ?? []).map(decodeEntry)

export const totalOccurrences = (occurrences: VerseOccurrences[]): number =>
  occurrences.reduce((total, { count }) => total + count, 0)

// Occurrences are read a book at a time — the text they are rendered from is
// stored that way. Canon order, as everything downstream renders in.
export const occurrencesByBook = <T extends { verseId: number }>(
  occurrences: T[],
): Map<number, T[]> => {
  const books = new Map<number, T[]>()
  for (const occurrence of occurrences) {
    const book = decodeVerseId(occurrence.verseId).book
    books.set(book, [...(books.get(book) ?? []), occurrence])
  }
  return new Map([...books].sort(([a], [b]) => a - b))
}

// A span stacking several numbers of one family is one occurrence of it: the
// count is of words tagged, not of numbers tagged on them.
const familyCounts = (content: VerseContent): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const tag of verseTagsOf(content))
    for (const family of new Set(tag.strongs.map(strongsFamily)))
      counts.set(family, (counts.get(family) ?? 0) + 1)
  return counts
}

export const buildConcordanceIndex = (
  books: Map<number, BookContent>,
): ConcordanceIndex => {
  const index: ConcordanceIndex = {}
  for (const book of [...books.keys()].sort((a, b) => a - b)) {
    const content = books.get(book) ?? {}
    const verseIds = Object.keys(content)
      .map(Number)
      .sort((a, b) => a - b)
    for (const verseId of verseIds)
      for (const [family, count] of familyCounts(content[verseId]))
        (index[family] ??= []).push(encodeEntry({ verseId, count }))
  }
  return index
}

// The spans one verse renders the family under, in reading order, so an
// occurrence row can emphasize the words themselves. Extended numbers answer
// under their family on both sides, as in the index.
export const familySpans = (
  content: VerseContent,
  strongsNumber: string,
): FormatSpan[] => {
  const family = strongsFamily(strongsNumber)
  return verseTagsOf(content)
    .filter((tag) =>
      tag.strongs.some((number) => strongsFamily(number) === family),
    )
    .map(({ start, end }) => ({ start, end }))
    .sort((a, b) => a.start - b.start)
}
