import type { BookContent } from './normalized-module'
import type { FormatSpan, VerseContent } from './verse-content'
import { verseTagsOf } from './verse-content'

// One Tagged Translation's concordance: every Strong's Family it tags, against
// the verse ids it tags them in, ascending. Verse ids only — the rendering of
// each occurrence is re-derived from that verse's own tag spans, so the index
// stays small enough to hold whole and never drifts from the text.
export type ConcordanceIndex = Record<string, number[]>

const FAMILY = /^([HG]\d+)[A-Za-z]*$/

// Occurrence matching is only honest at family granularity: tagged
// translations mostly predate the lettered disambiguations, so an extended
// number in either the tagging or the lookup answers under its family.
export const strongsFamily = (strongsNumber: string): string =>
  FAMILY.exec(strongsNumber)?.[1] ?? strongsNumber

export const buildConcordanceIndex = (
  books: Map<number, BookContent>,
): ConcordanceIndex => {
  const index: ConcordanceIndex = {}
  for (const book of [...books.keys()].sort((a, b) => a - b)) {
    const content = books.get(book) ?? {}
    const verseIds = Object.keys(content)
      .map(Number)
      .sort((a, b) => a - b)
    for (const verseId of verseIds) {
      const families = new Set(
        verseTagsOf(content[verseId]).flatMap((tag) =>
          tag.strongs.map(strongsFamily),
        ),
      )
      for (const family of families) (index[family] ??= []).push(verseId)
    }
  }
  return index
}

// Where one verse renders the family under study: the tag spans carrying it,
// in reading order, so the occurrence row can emphasize the words themselves.
// Extended numbers answer under their family on both sides, as in the index.
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
