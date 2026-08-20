import { verseTextOf, type BookContent } from '../modules'
import {
  isEmptyQuery,
  matchSearchQuery,
  type MatchSpan,
  type SearchQuery,
} from './search-query'

// One atom whose text satisfies the query, carrying the whole text and the
// spans that matched — the pane emphasizes them and the reader will take
// them over when a hit is activated.
export type SearchHit = {
  verseId: number
  text: string
  spans: MatchSpan[]
}

// All the scan asks of module storage. ModuleStore satisfies it as it
// stands, and the persistent index will answer the same queries from beside
// this seam rather than through it.
export type SearchContentSource = {
  bookContent: (moduleId: string, book: number) => Promise<BookContent | null>
}

const bookHits = (content: BookContent, query: SearchQuery): SearchHit[] =>
  Object.keys(content)
    .map(Number)
    .sort((a, b) => a - b)
    .flatMap((verseId) => {
      const text = verseTextOf(content[verseId])
      const spans = matchSearchQuery(text, query)
      return spans === null ? [] : [{ verseId, text, spans }]
    })

// A direct scan of the module's stored content, book by book in the order
// given, hits within a book in verse-id order — Canonical Grid order overall
// as long as the books are handed over in it.
export const scanModule = async (
  source: SearchContentSource,
  moduleId: string,
  books: readonly number[],
  query: SearchQuery,
): Promise<SearchHit[]> => {
  if (isEmptyQuery(query)) return []
  const hits: SearchHit[] = []
  for (const book of books) {
    const content = await source.bookContent(moduleId, book)
    if (content === null) continue
    hits.push(...bookHits(content, query))
  }
  return hits
}
