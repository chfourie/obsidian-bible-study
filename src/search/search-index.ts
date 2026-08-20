import { tokenizeText } from './fold-text'
import {
  isEmptyQuery,
  mergeMatchSpans,
  type MatchSpan,
  type SearchQuery,
  type SearchTerm,
} from './search-query'
import type { ModuleAtom, SearchMatch } from './search-scan'

// Bump whenever the serialized shape or the folding behind it changes: every
// stored index that carries an older stamp is rebuilt whole on load.
export const SEARCH_INDEX_FORMAT_VERSION = 2

// One appearance of a term in the module: which atom, which word of it, and
// the word's character offsets into that atom's stored text. Serialized flat,
// four numbers per occurrence, because there is one of these per word of the
// module.
const POSTING_FIELDS = 4

type Occurrence = {
  atom: number
  token: number
  start: number
  end: number
}

// The whole persisted index. Atoms are numbered by build order — Canonical
// Grid order — so hits sort by atom number alone. `terms` is sorted for the
// prefix lookup and `postings` runs parallel to it. No atom text is kept: the
// offsets address the module's own stored content, which a hit is read from.
export type SearchIndex = {
  formatVersion: number
  sourceChecksum: string
  verseIds: number[]
  terms: string[]
  postings: number[][]
}

export const buildSearchIndex = (
  atoms: readonly ModuleAtom[],
  sourceChecksum: string,
): SearchIndex => {
  const postingsByTerm = new Map<string, number[]>()
  atoms.forEach((atom, index) => {
    tokenizeText(atom.text).forEach((token, position) => {
      const postings = postingsByTerm.get(token.folded) ?? []
      postings.push(index, position, token.start, token.end)
      postingsByTerm.set(token.folded, postings)
    })
  })
  const terms = [...postingsByTerm.keys()].sort()
  return {
    formatVersion: SEARCH_INDEX_FORMAT_VERSION,
    sourceChecksum,
    verseIds: atoms.map((atom) => atom.verseId),
    terms,
    postings: terms.map((term) => postingsByTerm.get(term) ?? []),
  }
}

// Module content is immutable between downloads, so these two stamps are the
// whole staleness question — a mismatch means rebuild, never repair.
export const isCurrentSearchIndex = (
  index: SearchIndex,
  sourceChecksum: string,
): boolean =>
  index.formatVersion === SEARCH_INDEX_FORMAT_VERSION &&
  index.sourceChecksum === sourceChecksum

const firstTermFrom = (terms: readonly string[], prefix: string): number => {
  let low = 0
  let high = terms.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (terms[middle] < prefix) low = middle + 1
    else high = middle
  }
  return low
}

const occurrencesOf = (index: SearchIndex, prefix: string): Occurrence[] => {
  const occurrences: Occurrence[] = []
  for (
    let term = firstTermFrom(index.terms, prefix);
    term < index.terms.length && index.terms[term].startsWith(prefix);
    term += 1
  ) {
    const postings = index.postings[term] ?? []
    for (let at = 0; at < postings.length; at += POSTING_FIELDS) {
      occurrences.push({
        atom: postings[at],
        token: postings[at + 1],
        start: postings[at + 2],
        end: postings[at + 3],
      })
    }
  }
  return occurrences
}

// Postings arrive grouped by term; a query answers per atom, so they are
// regrouped, in word order within each atom.
const byAtom = (occurrences: Occurrence[]): Map<number, Occurrence[]> => {
  const atoms = new Map<number, Occurrence[]>()
  for (const occurrence of occurrences) {
    const found = atoms.get(occurrence.atom) ?? []
    found.push(occurrence)
    atoms.set(occurrence.atom, found)
  }
  atoms.forEach((found) => found.sort((a, b) => a.token - b.token))
  return atoms
}

const wordSpans = (
  index: SearchIndex,
  word: string,
): Map<number, MatchSpan[]> =>
  new Map(
    [...byAtom(occurrencesOf(index, word))].map(([atom, occurrences]) => [
      atom,
      occurrences.map(({ start, end }) => ({ start, end })),
    ]),
  )

// Contiguous means consecutive words of the atom, which the postings answer
// on their own: the phrase's next word must sit at the next word position,
// and the span runs from the first word's start offset to the last's end.
const phraseSpans = (
  index: SearchIndex,
  words: string[],
): Map<number, MatchSpan[]> => {
  const perWord = words.map((word) => byAtom(occurrencesOf(index, word)))
  const spansByAtom = new Map<number, MatchSpan[]>()
  for (const [atom, starts] of perWord[0]) {
    const spans: MatchSpan[] = []
    for (const first of starts) {
      let last = first
      const contiguous = perWord.slice(1).every((word) => {
        const next = word
          .get(atom)
          ?.find((occurrence) => occurrence.token === last.token + 1)
        if (next === undefined) return false
        last = next
        return true
      })
      if (contiguous) spans.push({ start: first.start, end: last.end })
    }
    if (spans.length > 0) spansByAtom.set(atom, spans)
  }
  return spansByAtom
}

const termSpans = (
  index: SearchIndex,
  term: SearchTerm,
): Map<number, MatchSpan[]> =>
  term.kind === 'word'
    ? wordSpans(index, term.word)
    : phraseSpans(index, term.words)

// Word-AND is postings intersection: an atom survives only while every term
// so far has found it, and keeps the spans all of them matched.
const intersect = (
  matched: Map<number, MatchSpan[]>,
  found: Map<number, MatchSpan[]>,
): Map<number, MatchSpan[]> => {
  const kept = new Map<number, MatchSpan[]>()
  for (const [atom, spans] of found) {
    const already = matched.get(atom)
    if (already !== undefined) kept.set(atom, [...already, ...spans])
  }
  return kept
}

export const searchIndex = (
  index: SearchIndex,
  query: SearchQuery,
): SearchMatch[] => {
  if (isEmptyQuery(query)) return []
  let matched: Map<number, MatchSpan[]> | null = null
  for (const term of query.terms) {
    const found = termSpans(index, term)
    matched = matched === null ? found : intersect(matched, found)
    if (matched.size === 0) return []
  }
  const hits = matched ?? new Map<number, MatchSpan[]>()
  return [...hits.keys()]
    .sort((a, b) => a - b)
    .map((atom) => ({
      verseId: index.verseIds[atom],
      spans: mergeMatchSpans(hits.get(atom) ?? []),
    }))
}
