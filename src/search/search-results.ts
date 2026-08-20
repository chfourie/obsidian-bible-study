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

// How many of a book's hits the list prints before the rest wait behind an
// expander, so one crowded book cannot bury the books under it.
export const HITS_SHOWN_PER_BOOK = 25

// A book's hits under one heading, counted — hits arrive in Canonical Grid
// order, so the groups come out in it too.
export type SearchBookGroup = {
  book: number
  name: string
  count: number
  hits: SearchHitView[]
}

// A group as the list prints it: `hits` is what shows, `count` stays the whole
// group's size, and `hiddenHits` is what the expander offers.
export type SearchBookView = SearchBookGroup & {
  collapsed: boolean
  hiddenHits: number
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
): SearchBookGroup[] => {
  const groups: SearchBookGroup[] = []
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

// A collapsed group prints no hits at all; an expanded one prints past the cap.
export const bookViews = (
  groups: readonly SearchBookGroup[],
  collapsed: ReadonlySet<number>,
  expanded: ReadonlySet<number>,
): SearchBookView[] =>
  groups.map((group) => {
    const isCollapsed = collapsed.has(group.book)
    const hits = isCollapsed
      ? []
      : expanded.has(group.book)
        ? group.hits
        : group.hits.slice(0, HITS_SHOWN_PER_BOOK)
    return {
      ...group,
      hits,
      collapsed: isCollapsed,
      hiddenHits: isCollapsed ? 0 : group.count - hits.length,
    }
  })
