import { tokenizeText, type TextToken } from './fold-text'

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

const wordSpans = (tokens: TextToken[], word: string): MatchSpan[] =>
  tokens
    .filter((token) => token.folded.startsWith(word))
    .map((token) => ({ start: token.start, end: token.end }))

// Contiguous means consecutive words: whatever punctuation or spacing sits
// between them is carried along inside the one span the phrase emphasizes.
const phraseSpans = (tokens: TextToken[], words: string[]): MatchSpan[] => {
  const spans: MatchSpan[] = []
  for (let index = 0; index + words.length <= tokens.length; index += 1) {
    const contiguous = words.every((word, offset) =>
      tokens[index + offset].folded.startsWith(word),
    )
    if (!contiguous) continue
    spans.push({
      start: tokens[index].start,
      end: tokens[index + words.length - 1].end,
    })
  }
  return spans
}

const mergeSpans = (spans: MatchSpan[]): MatchSpan[] => {
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

export const matchTokens = (
  tokens: TextToken[],
  query: SearchQuery,
): MatchSpan[] | null => {
  if (isEmptyQuery(query)) return null
  const spans: MatchSpan[] = []
  for (const term of query.terms) {
    const found =
      term.kind === 'word'
        ? wordSpans(tokens, term.word)
        : phraseSpans(tokens, term.words)
    if (found.length === 0) return null
    spans.push(...found)
  }
  return mergeSpans(spans)
}

// The spans every term of the query matched, in text order, or null when the
// text does not satisfy the query at all.
export const matchSearchQuery = (
  text: string,
  query: SearchQuery,
): MatchSpan[] | null => matchTokens(tokenizeText(text), query)
