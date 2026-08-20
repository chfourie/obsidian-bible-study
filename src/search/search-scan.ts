import { verseTextOf, type BookContent } from '../modules'
import { decodeVerseId } from '../reference'
import type { MatchSpan } from './search-query'

// One atom the index says satisfies the query: which atom, and the character
// ranges of its stored text that matched. The index answers this much on its
// own — it stores no text of its own to answer with.
export type SearchMatch = {
  verseId: number
  spans: MatchSpan[]
}

// A match with the atom's text read back from the module — the pane
// emphasizes the spans within it and the reader takes them over when a hit is
// activated. Offsets index this text, the module's own stored atom text.
export type SearchHit = SearchMatch & {
  text: string
}

// One indexable unit of a module: an atom id and the text the index holds for
// it, so a hit needs no further reading of module content.
export type ModuleAtom = {
  verseId: number
  text: string
}

// What the search asks of module storage: the content to index, and — since
// the index keeps no copy of it — the content a hit's text is read back from.
export type SearchContentSource = {
  bookContent: (moduleId: string, book: number) => Promise<BookContent | null>
}

// The text of the matched atoms, read from the module's own stored content.
// Matches arrive in atom order, which groups them by book, so a query reads
// each book holding a hit once and no other book at all.
export const hitsWithText = async (
  source: SearchContentSource,
  moduleId: string,
  matches: readonly SearchMatch[],
): Promise<SearchHit[]> => {
  const hits: SearchHit[] = []
  let read: number | null = null
  let content: BookContent | null = null
  for (const match of matches) {
    const book = decodeVerseId(match.verseId).book
    if (book !== read) {
      read = book
      content = await source.bookContent(moduleId, book)
    }
    const verse = content?.[match.verseId]
    if (verse !== undefined) hits.push({ ...match, text: verseTextOf(verse) })
  }
  return hits
}

// A book's atoms in verse-id order, whatever order they are stored in — the
// order decides the index's atom numbering, and with it the order hits come
// back in.
export const bookAtoms = (content: BookContent): ModuleAtom[] =>
  Object.keys(content)
    .map(Number)
    .sort((a, b) => a - b)
    .map((verseId) => ({ verseId, text: verseTextOf(content[verseId]) }))
