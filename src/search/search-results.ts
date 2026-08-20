import {
  bookName,
  decodeVerseId,
  referenceLabel,
  type Reference,
} from '../reference'
import type { MatchSpan } from './search-query'
import type { SearchHit } from './search-scan'

// One run of a hit's text, told apart by whether the query matched it: the
// view emphasizes the matched runs and prints the rest as it stands.
export type SearchHitSegment = {
  text: string
  matched: boolean
}

export type SearchHitView = {
  verseId: number
  reference: Reference
  label: string
  segments: SearchHitSegment[]
}

// A book's hits under one heading, counted — hits arrive in Canonical Grid
// order, so the groups come out in it too.
export type SearchBookView = {
  book: number
  name: string
  count: number
  hits: SearchHitView[]
}

export const emphasizedSegments = (
  text: string,
  spans: readonly MatchSpan[],
): SearchHitSegment[] => {
  const segments: SearchHitSegment[] = []
  const push = (slice: string, matched: boolean): void => {
    if (slice.length > 0) segments.push({ text: slice, matched })
  }
  let cursor = 0
  for (const span of spans) {
    push(text.slice(cursor, span.start), false)
    push(text.slice(span.start, span.end), true)
    cursor = span.end
  }
  push(text.slice(cursor), false)
  return segments
}

const hitView = (hit: SearchHit): SearchHitView => {
  const reference: Reference = {
    book: decodeVerseId(hit.verseId).book,
    ranges: [{ startId: hit.verseId, endId: hit.verseId }],
  }
  return {
    verseId: hit.verseId,
    reference,
    label: referenceLabel(reference),
    segments: emphasizedSegments(hit.text, hit.spans),
  }
}

export const groupHitsByBook = (
  hits: readonly SearchHit[],
): SearchBookView[] => {
  const groups: SearchBookView[] = []
  for (const hit of hits) {
    const book = decodeVerseId(hit.verseId).book
    let group = groups[groups.length - 1]
    if (group === undefined || group.book !== book) {
      group = { book, name: bookName(book), count: 0, hits: [] }
      groups.push(group)
    }
    group.hits.push(hitView(hit))
    group.count = group.hits.length
  }
  return groups
}
