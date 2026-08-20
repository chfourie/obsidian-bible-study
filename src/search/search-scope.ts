import { decodeVerseId, isNonBiblicalBook } from '../reference'
import type { SearchHit } from './search-scan'

export type TestamentFilter = 'all' | 'ot' | 'nt'

// Book 39 closes the Old Testament on the Canonical Grid and 40 opens the New.
const LAST_OLD_TESTAMENT_BOOK = 39

// One installed translation as the scope picker names it.
export type SearchTranslation = {
  id: string
  label: string
}

// One installed Book as the scope picker names it: the module a query fans out
// to, and the book number its hits carry.
export type SearchScopeBook = {
  moduleId: string
  bookId: number
  label: string
}

// Everything the scope can be chosen from right now — what is installed, and
// the translation to fall back on when the remembered one is not.
export type SearchScopeOptions = {
  translations: SearchTranslation[]
  books: SearchScopeBook[]
  fallbackTranslationId: string | null
}

// What one query searches over, resolved against what is installed: never a
// module that is gone. With `scripture` off the translation stays chosen but
// unsearched, and the query runs over the selected Books alone.
export type SearchScope = {
  translation: SearchTranslation | null
  testament: TestamentFilter
  books: SearchScopeBook[]
  scripture: boolean
}

// The scope as it survives a restart. Books are remembered as the ones opted
// out of, so a Book installed later is searched without the picker having to
// be visited; a translation that is gone resolves to the Fallback Translation
// rather than to nothing.
export type StoredSearchScope = {
  translationId: string | null
  testament: TestamentFilter
  excludedBookIds: string[]
  // Optional because a scope stored before the flag existed carries no
  // `scripture` at all — and searching scripture is what it always did.
  scripture?: boolean
}

export const defaultStoredSearchScope = (): StoredSearchScope => ({
  translationId: null,
  testament: 'all',
  excludedBookIds: [],
  scripture: true,
})

export const resolveSearchScope = (
  stored: StoredSearchScope,
  options: SearchScopeOptions,
): SearchScope => {
  const named = options.translations.find(
    (translation) => translation.id === stored.translationId,
  )
  const fallback = options.translations.find(
    (translation) => translation.id === options.fallbackTranslationId,
  )
  return {
    translation: named ?? fallback ?? null,
    testament: stored.testament,
    books: options.books.filter(
      (book) => !stored.excludedBookIds.includes(book.moduleId),
    ),
    scripture: stored.scripture !== false,
  }
}

export const storedSearchScope = (
  scope: SearchScope,
  options: SearchScopeOptions,
): StoredSearchScope => ({
  translationId: scope.translation?.id ?? null,
  testament: scope.testament,
  excludedBookIds: options.books
    .filter(
      (book) =>
        !scope.books.some((chosen) => chosen.moduleId === book.moduleId),
    )
    .map((book) => book.moduleId),
  scripture: scope.scripture,
})

// The modules a query fans out over, translation first so its hits are read
// before any Book's. With scripture left out the translation's module is
// never read at all.
export const scopeModuleIds = (scope: SearchScope): string[] => [
  ...(scope.scripture && scope.translation !== null
    ? [scope.translation.id]
    : []),
  ...scope.books.map((book) => book.moduleId),
]

// The testament filter is a Canonical Grid book range, so it has nothing to
// say about a Book: its hits stand whichever testament is filtered for.
const inTestament = (testament: TestamentFilter, book: number): boolean => {
  if (testament === 'all' || isNonBiblicalBook(book)) return true
  return testament === 'ot'
    ? book <= LAST_OLD_TESTAMENT_BOOK
    : book > LAST_OLD_TESTAMENT_BOOK
}

export const hitsInTestament = <T extends Pick<SearchHit, 'verseId'>>(
  hits: readonly T[],
  testament: TestamentFilter,
): T[] =>
  hits.filter((hit) =>
    inTestament(testament, decodeVerseId(hit.verseId).book),
  )
