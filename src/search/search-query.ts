import { tokenizeText } from './fold-text'

// A bare word matches as a prefix; a quoted phrase adds contiguity, its own
// words still matching as prefixes.
export type SearchTerm =
  | { kind: 'word'; word: string }
  | { kind: 'phrase'; words: string[] }

export type SearchQuery = {
  terms: SearchTerm[]
}

// A matched run of the searched text, as character offsets into that text —
// what the pane emphasizes and what the reader will pick up when it takes a
// hit over.
export type MatchSpan = {
  start: number
  end: number
}

export const isEmptyQuery = (query: SearchQuery): boolean =>
  query.terms.length === 0

// Quotes are the only punctuation the query language spells with: they cut
// the text into alternating bare and quoted segments, and the tokenizer
// takes each segment down to its words. An unclosed quote leaves a final
// quoted segment, which is exactly the phrase the user was still typing.
export const parseSearchQuery = (text: string): SearchQuery => {
  const terms: SearchTerm[] = []
  text.split('"').forEach((segment, index) => {
    const words = tokenizeText(segment).map((token) => token.folded)
    if (words.length === 0) return
    if (index % 2 === 1) terms.push({ kind: 'phrase', words })
    else words.forEach((word) => terms.push({ kind: 'word', word }))
  })
  return { terms }
}

// Overlapping emphasis is one emphasized run: whichever terms found them, the
// spans a hit carries are sorted, merged and non-overlapping.
export const mergeMatchSpans = (spans: MatchSpan[]): MatchSpan[] => {
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: MatchSpan[] = []
  for (const span of sorted) {
    const last = merged[merged.length - 1]
    if (last !== undefined && span.start < last.end) {
      last.end = Math.max(last.end, span.end)
      continue
    }
    merged.push({ ...span })
  }
  return merged
}
