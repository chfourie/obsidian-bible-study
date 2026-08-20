import { verseTextOf, type BookContent } from '../modules'
import type { MatchSpan } from './search-query'

// One atom whose text satisfies the query, carrying the whole text and the
// spans that matched — the pane emphasizes them and the reader will take
// them over when a hit is activated.
export type SearchHit = {
  verseId: number
  text: string
  spans: MatchSpan[]
}

// One indexable unit of a module: an atom id and the text the index holds for
// it, so a hit needs no further reading of module content.
export type ModuleAtom = {
  verseId: number
  text: string
}

// All the index build asks of module storage. ModuleStore satisfies it as it
// stands, and nothing but the build reads through it any more.
export type SearchContentSource = {
  bookContent: (moduleId: string, book: number) => Promise<BookContent | null>
}

// A book's atoms in verse-id order, whatever order they are stored in — the
// order decides the index's atom numbering, and with it the order hits come
// back in.
export const bookAtoms = (content: BookContent): ModuleAtom[] =>
  Object.keys(content)
    .map(Number)
    .sort((a, b) => a - b)
    .map((verseId) => ({ verseId, text: verseTextOf(content[verseId]) }))
