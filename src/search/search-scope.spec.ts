import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import {
  defaultStoredSearchScope,
  hitsInTestament,
  resolveSearchScope,
  scopeModuleIds,
  storedSearchScope,
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
      { translationId: 'kjv', testament: 'nt', excludedBookIds: [] },
      options(),
    )
    expect(scope.translation).toEqual({ id: 'kjv', label: 'KJV' })
    expect(scope.testament).toBe('nt')
  })

  it('falls back to the Fallback Translation when the remembered module is gone', () => {
    const scope = resolveSearchScope(
      { translationId: 'niv', testament: 'all', excludedBookIds: [] },
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
      },
      options(),
    )
    expect(stored).toEqual({
      translationId: 'kjv',
      testament: 'ot',
      excludedBookIds: ['hum-m1895'],
    })
  })

  it('searches a book installed after the scope was narrowed', () => {
    const stored = storedSearchScope(
      {
        translation: { id: 'web', label: 'WEB' },
        testament: 'all',
        books: [],
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
