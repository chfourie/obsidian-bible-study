import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import {
  defaultStoredSearchScope,
  hitsInScope,
  hitsInTestament,
  resolveSearchScope,
  scopeModuleIds,
  searchBookChoices,
  storedSearchScope,
  type SearchScope,
  type SearchScopeOptions,
} from './search-scope'

const HUMILITY = { moduleId: 'hum-m1895', bookId: 101, label: 'Humility' }
const CONFESSIONS = { moduleId: 'con-a0400', bookId: 102, label: 'Confessions' }

const options = (
  overrides: Partial<SearchScopeOptions> = {},
): SearchScopeOptions => ({
  translations: [
    { id: 'web', label: 'WEB' },
    { id: 'kjv', label: 'KJV' },
  ],
  books: [HUMILITY, CONFESSIONS],
  fallbackTranslationId: 'web',
  ...overrides,
})

const hit = (book: number, chapter: number, verse: number) => ({
  verseId: makeVerseId(book, chapter, verse),
  text: 'text',
  spans: [],
})

const hitBooks = (verseIds: { verseId: number }[]) =>
  verseIds.map(({ verseId }) => Math.floor(verseId / 1_000_000))

describe('search scope', () => {
  it('searches the fallback translation, both testaments and every book by default', () => {
    const scope = resolveSearchScope(defaultStoredSearchScope(), options())
    expect(scope.translation).toEqual({ id: 'web', label: 'WEB' })
    expect(scope.testament).toBe('all')
    expect(scope.books).toEqual([HUMILITY, CONFESSIONS])
  })

  it('has nothing to search when no module is installed', () => {
    const scope = resolveSearchScope(
      defaultStoredSearchScope(),
      options({ translations: [], books: [], fallbackTranslationId: null }),
    )
    expect(scope.translation).toBeNull()
    expect(scopeModuleIds(scope)).toEqual([])
  })

  it('keeps the remembered translation while its module is installed', () => {
    const scope = resolveSearchScope(
      { translationId: 'kjv', testament: 'nt', excludedBookIds: [], bookId: null },
      options(),
    )
    expect(scope.translation).toEqual({ id: 'kjv', label: 'KJV' })
    expect(scope.testament).toBe('nt')
  })

  it('falls back to the Fallback Translation when the remembered module is gone', () => {
    const scope = resolveSearchScope(
      { translationId: 'niv', testament: 'all', excludedBookIds: [], bookId: null },
      options(),
    )
    expect(scope.translation).toEqual({ id: 'web', label: 'WEB' })
  })

  it('searches only the books that were not opted out of', () => {
    const scope = resolveSearchScope(
      {
        translationId: 'web',
        testament: 'all',
        excludedBookIds: ['hum-m1895'],
        bookId: null,
      },
      options(),
    )
    expect(scope.books).toEqual([CONFESSIONS])
    expect(scopeModuleIds(scope)).toEqual(['web', 'con-a0400'])
  })

  it('leaves out a remembered book whose module is gone', () => {
    const scope = resolveSearchScope(defaultStoredSearchScope(), {
      ...options(),
      books: [HUMILITY],
    })
    expect(scope.books).toEqual([HUMILITY])
  })

  it('remembers a narrowed scope as the books it leaves out', () => {
    const stored = storedSearchScope(
      {
        translation: { id: 'kjv', label: 'KJV' },
        testament: 'ot',
        books: [CONFESSIONS],
        book: null,
      },
      options(),
    )
    expect(stored).toEqual({
      translationId: 'kjv',
      testament: 'ot',
      excludedBookIds: ['hum-m1895'],
      bookId: null,
    })
  })

  it('searches a book installed after the scope was narrowed', () => {
    const stored = storedSearchScope(
      {
        translation: { id: 'web', label: 'WEB' },
        testament: 'all',
        books: [],
        book: null,
      },
      options({ books: [HUMILITY] }),
    )
    expect(resolveSearchScope(stored, options()).books).toEqual([CONFESSIONS])
  })

  it('keeps every hit when both testaments are searched', () => {
    const hits = [hit(39, 4, 6), hit(40, 1, 1), hit(101, 1, 1)]
    expect(hitsInTestament(hits, 'all')).toEqual(hits)
  })

  it('keeps hits up to Malachi for the Old Testament', () => {
    const hits = [hit(1, 1, 1), hit(39, 4, 6), hit(40, 1, 1), hit(66, 22, 21)]
    expect(hitBooks(hitsInTestament(hits, 'ot'))).toEqual([1, 39])
  })

  it('keeps hits from Matthew on for the New Testament', () => {
    const hits = [hit(1, 1, 1), hit(39, 4, 6), hit(40, 1, 1), hit(66, 22, 21)]
    expect(hitBooks(hitsInTestament(hits, 'nt'))).toEqual([40, 66])
  })

  it('leaves book hits alone whichever testament is filtered for', () => {
    const hits = [hit(101, 1, 1), hit(102, 3, 5)]
    expect(hitsInTestament(hits, 'ot')).toEqual(hits)
    expect(hitsInTestament(hits, 'nt')).toEqual(hits)
  })
})

const GENESIS_CHOICE = { bookId: 1, label: 'Genesis', moduleId: null }
const HUMILITY_CHOICE = {
  bookId: 101,
  label: 'Humility',
  moduleId: 'hum-m1895',
}

describe('search scope narrowed to one book', () => {
  it('offers every scripture book, then every installed book', () => {
    const choices = searchBookChoices(options())
    expect(choices).toHaveLength(68)
    expect(choices[0]).toEqual(GENESIS_CHOICE)
    expect(choices[65]).toEqual({
      bookId: 66,
      label: 'Revelation',
      moduleId: null,
    })
    expect(choices.slice(66)).toEqual([
      HUMILITY_CHOICE,
      { bookId: 102, label: 'Confessions', moduleId: 'con-a0400' },
    ])
  })

  it('searches every book by default', () => {
    const scope = resolveSearchScope(defaultStoredSearchScope(), options())
    expect(scope.book).toBeNull()
  })

  it('remembers a scripture book by its Canonical Grid number', () => {
    const stored = storedSearchScope(
      {
        translation: { id: 'web', label: 'WEB' },
        testament: 'all',
        books: [HUMILITY, CONFESSIONS],
        book: GENESIS_CHOICE,
      },
      options(),
    )
    expect(stored.bookId).toBe(1)
    expect(resolveSearchScope(stored, options()).book).toEqual(GENESIS_CHOICE)
  })

  it('remembers an installed book, and searches only its module', () => {
    const stored = storedSearchScope(
      {
        translation: { id: 'web', label: 'WEB' },
        testament: 'all',
        books: [HUMILITY, CONFESSIONS],
        book: HUMILITY_CHOICE,
      },
      options(),
    )
    expect(stored.bookId).toBe(101)
    const scope = resolveSearchScope(stored, options())
    expect(scope.book).toEqual(HUMILITY_CHOICE)
    expect(scopeModuleIds(scope)).toEqual(['hum-m1895'])
  })

  it('falls back to every book when the remembered book’s module is gone', () => {
    const scope = resolveSearchScope(
      { ...defaultStoredSearchScope(), bookId: 101 },
      options({ books: [CONFESSIONS] }),
    )
    expect(scope.book).toBeNull()
    expect(scopeModuleIds(scope)).toEqual(['web', 'con-a0400'])
  })

  it('searches a scripture book in the chosen translation alone', () => {
    const scope = resolveSearchScope(
      { ...defaultStoredSearchScope(), bookId: 43 },
      options(),
    )
    expect(scopeModuleIds(scope)).toEqual(['web'])
  })

  it('has nothing to search for a scripture book with no translation', () => {
    const scope = resolveSearchScope(
      { ...defaultStoredSearchScope(), bookId: 43 },
      options({ translations: [], fallbackTranslationId: null }),
    )
    expect(scopeModuleIds(scope)).toEqual([])
  })

  it('keeps only the chosen book’s hits, testament filter and all', () => {
    const scope: SearchScope = {
      translation: { id: 'web', label: 'WEB' },
      testament: 'nt',
      books: [HUMILITY],
      book: GENESIS_CHOICE,
    }
    const hits = [hit(1, 1, 1), hit(43, 15, 1), hit(101, 1, 1)]
    expect(hitBooks(hitsInScope(hits, scope))).toEqual([1])
  })

  it('filters by testament while every book is searched', () => {
    const scope: SearchScope = {
      translation: { id: 'web', label: 'WEB' },
      testament: 'nt',
      books: [HUMILITY],
      book: null,
    }
    const hits = [hit(1, 1, 1), hit(43, 15, 1), hit(101, 1, 1)]
    expect(hitBooks(hitsInScope(hits, scope))).toEqual([43, 101])
  })
})
