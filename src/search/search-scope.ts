import { BOOKS, decodeVerseId, isNonBiblicalBook } from '../reference'
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

// One book the scope can narrow to: a scripture book, searched in whichever
// translation the scope names, or an installed Book, searched in its own
// module.
export type SearchBookChoice = {
  bookId: number
  label: string
  moduleId: string | null
}

// Every book one query can be narrowed to: the compiled-in canon first, then
// whatever Books are installed, both in book-number order.
export const searchBookChoices = (
  options: SearchScopeOptions,
): SearchBookChoice[] => [
  ...BOOKS.map((book) => ({
    bookId: book.id,
    label: book.name,
    moduleId: null,
  })),
  ...options.books.map((book) => ({
    bookId: book.bookId,
    label: book.label,
    moduleId: book.moduleId,
  })),
]

// What one query searches over, resolved against what is installed: never a
// module that is gone. A chosen `book` narrows the whole query to it, leaving
// the testament filter and the Books selection with nothing to say.
export type SearchScope = {
  translation: SearchTranslation | null
  testament: TestamentFilter
  books: SearchScopeBook[]
  book: SearchBookChoice | null
}

// The scope as it survives a restart. Books are remembered as the ones opted
// out of, so a Book installed later is searched without the picker having to
// be visited; a translation that is gone resolves to the Fallback Translation
// rather than to nothing, and a single book whose module is gone resolves to
// every book.
export type StoredSearchScope = {
  translationId: string | null
  testament: TestamentFilter
  excludedBookIds: string[]
  bookId: number | null
}

export const defaultStoredSearchScope = (): StoredSearchScope => ({
  translationId: null,
  testament: 'all',
  excludedBookIds: [],
  bookId: null,
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
    book:
      searchBookChoices(options).find(
        (choice) => choice.bookId === stored.bookId,
      ) ?? null,
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
  bookId: scope.book?.bookId ?? null,
})

// The modules a query fans out over, translation first so its hits are read
// before any Book's. Narrowed to one book, that is the one module holding it.
export const scopeModuleIds = (scope: SearchScope): string[] => {
  const translationIds =
    scope.translation === null ? [] : [scope.translation.id]
  if (scope.book === null) {
    return [...translationIds, ...scope.books.map((book) => book.moduleId)]
  }
  return scope.book.moduleId === null ? translationIds : [scope.book.moduleId]
}

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

export const hitsInBook = <T extends Pick<SearchHit, 'verseId'>>(
  hits: readonly T[],
  book: number,
): T[] => hits.filter((hit) => decodeVerseId(hit.verseId).book === book)

// What the scope keeps of what its modules answered: one book alone, or every
// book the testament filter allows.
export const hitsInScope = <T extends Pick<SearchHit, 'verseId'>>(
  hits: readonly T[],
  scope: SearchScope,
): T[] =>
  scope.book === null
    ? hitsInTestament(hits, scope.testament)
    : hitsInBook(hits, scope.book.bookId)
