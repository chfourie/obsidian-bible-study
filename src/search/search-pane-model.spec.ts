import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FakeSearchIndexSource } from '../../tests/fixtures/fake-search-index-source'
import {
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import type { NavigationOptions } from '../contracts'
import type { BookContent } from '../modules'
import { BOOKS, makeVerseId, type Reference } from '../reference'
import { SearchEngine } from './search-engine'
import { SearchPaneModel, type SearchPaneDeps } from './search-pane-model'
import type { SearchQuery } from './search-query'
import { HITS_SHOWN_PER_BOOK } from './search-results'
import {
  defaultStoredSearchScope,
  resolveSearchScope,
  storedSearchScope,
  type SearchScopeBook,
  type SearchScopeOptions,
  type SearchTranslation,
  type StoredSearchScope,
} from './search-scope'

const verses = (
  book: number,
  chapter: number,
  texts: Record<number, string>,
): BookContent =>
  Object.fromEntries(
    Object.entries(texts).map(([verse, text]) => [
      makeVerseId(book, chapter, Number(verse)),
      text,
    ]),
  )

const WEB_CONTENT: Record<number, BookContent> = {
  1: verses(1, 1, {
    1: 'In the beginning God created the heavens and the earth.',
    2: 'The earth was formless and empty.',
  }),
  43: verses(43, 15, {
    1: 'I am the true vine.',
    9: 'Even so I have loved you. Remain in my love.',
    12: 'This is my commandment, that you love one another.',
    13: 'Greater grace has no one than this: my beloved friend lays down his life.',
  }),
}

const HUMILITY_BOOK_OPTION: SearchScopeBook = {
  moduleId: 'hum-m1895',
  bookId: 101,
  label: 'Humility',
}

const HUMILITY_CONTENT: Record<number, BookContent> = {
  101: {
    [makeVerseId(101, 1, 2)]:
      'Humility is the only soil in which the graces take root.',
    [makeVerseId(101, 2, 1)]: 'The life of Jesus is our love and our humility.',
  },
}

type Opened = {
  reference: Reference
  translationId: string | null
  options: NavigationOptions | undefined
}

type Harness = {
  translations?: SearchTranslation[]
  books?: SearchScopeBook[]
  fallbackTranslationId?: string | null
  content?: Record<string, Record<number, BookContent>>
  bookNumbers?: Record<string, number>
}

const harness = ({
  translations = [{ id: 'web', label: 'WEB' }],
  books = [],
  fallbackTranslationId = 'web',
  content = { web: WEB_CONTENT },
  bookNumbers = {},
}: Harness = {}) => {
  const source = new FakeSearchIndexSource(content, undefined, bookNumbers)
  const engine = new SearchEngine(
    source,
    BOOKS.map((book) => book.id),
  )
  const opened: Opened[] = []
  const searches: { moduleId: string; query: SearchQuery }[] = []
  // The scope is held the way the feature holds it — remembered in its stored
  // form and resolved against what is installed on every read.
  let stored: StoredSearchScope = defaultStoredSearchScope()
  const options = (): SearchScopeOptions => ({
    translations,
    books,
    fallbackTranslationId,
  })
  const deps: SearchPaneDeps = {
    scopeOptions: options,
    scope: () => resolveSearchScope(stored, options()),
    chooseScope: (scope) => {
      stored = storedSearchScope(scope, options())
    },
    search: (moduleId, query, onProgress) => {
      searches.push({ moduleId, query })
      return engine.search(moduleId, query, onProgress)
    },
    openHit: (reference, translationId, options) => {
      opened.push({ reference, translationId, options })
    },
  }
  return {
    model: new SearchPaneModel(deps),
    opened,
    searches,
    searchedModules: () => searches.map((search) => search.moduleId),
    reads: source.contentReads,
    stored: () => stored,
  }
}

const bookSummary = (model: SearchPaneModel) =>
  model.view.books.map(({ name, count }) => ({ name, count }))

const labels = (model: SearchPaneModel) =>
  model.view.books.flatMap((group) => group.hits.map((hit) => hit.label))

describe('SearchPaneModel', () => {
  it('starts idle with nothing searched', () => {
    const { model } = harness()
    expect(model.view.status).toBe('idle')
    expect(model.view.query).toBe('')
    expect(model.view.books).toEqual([])
    expect(model.view.translationLabel).toBe('WEB')
  })

  it('runs nothing while the query is being typed', async () => {
    const { model, searches, reads } = harness()
    model.setQuery('lo')
    model.setQuery('love')
    expect(model.view.query).toBe('love')
    expect(searches).toEqual([])
    expect(reads).toEqual([])
    expect(model.view.status).toBe('idle')
  })

  it('searches only on submit, and shows what the query found', async () => {
    const { model, searches } = harness()
    model.setQuery('vine')
    await model.submit()
    expect(searches).toHaveLength(1)
    expect(model.view.status).toBe('ok')
    expect(model.view.submittedQuery).toBe('vine')
    expect(model.view.totalHits).toBe(1)
    expect(labels(model)).toEqual(['John 15:1'])
  })

  it('matches words as prefixes, never inside a longer word', async () => {
    const { model } = harness()
    model.setQuery('love')
    await model.submit()
    expect(labels(model)).toEqual(['John 15:9', 'John 15:12'])
  })

  it('requires every word of the query in one verse', async () => {
    const { model } = harness()
    model.setQuery('earth formless')
    await model.submit()
    expect(labels(model)).toEqual(['Genesis 1:2'])
  })

  it('requires a quoted phrase to appear contiguously', async () => {
    const { model } = harness()
    model.setQuery('"in the beginning"')
    await model.submit()
    expect(labels(model)).toEqual(['Genesis 1:1'])
    model.setQuery('"in the earth"')
    await model.submit()
    expect(model.view.status).toBe('no-results')
  })

  it('folds case and diacritics on both sides of the query', async () => {
    const { model } = harness({
      translations: [{ id: 'esp', label: 'ESP' }],
      fallbackTranslationId: 'esp',
      content: { esp: { 43: verses(43, 15, { 1: 'Yo soy la vid verdadéra.' }) } },
    })
    model.setQuery('VERDADERA')
    await model.submit()
    expect(labels(model)).toEqual(['John 15:1'])
  })

  it('folds non-Latin scripts the same way', async () => {
    const { model } = harness({
      translations: [{ id: 'grk', label: 'GRK' }],
      fallbackTranslationId: 'grk',
      content: { grk: { 43: verses(43, 1, { 1: 'Ἐν ἀρχῇ ἦν ὁ Λόγος' }) } },
    })
    model.setQuery('λογος')
    await model.submit()
    expect(labels(model)).toEqual(['John 1:1'])
  })

  it('groups hits by book in canonical order, with a count per book', async () => {
    const { model } = harness()
    model.setQuery('the')
    await model.submit()
    expect(bookSummary(model)).toEqual([
      { name: 'Genesis', count: 2 },
      { name: 'John', count: 1 },
    ])
    expect(model.view.totalHits).toBe(3)
  })

  it('shows the whole verse with the matched words emphasized', async () => {
    const { model } = harness()
    model.setQuery('vine')
    await model.submit()
    expect(model.view.books[0].hits[0].segments).toEqual([
      { text: 'I am the true ', matched: false },
      { text: 'vine', matched: true },
      { text: '.', matched: false },
    ])
  })

  it('reports a query that found nothing', async () => {
    const { model } = harness()
    model.setQuery('leviathan')
    await model.submit()
    expect(model.view.status).toBe('no-results')
    expect(model.view.submittedQuery).toBe('leviathan')
    expect(model.view.books).toEqual([])
  })

  it('labels the total once a search has run, nothing found included', async () => {
    const { model } = harness()
    expect(model.view.totalLabel).toBeNull()
    model.setQuery('vine')
    await model.submit()
    expect(model.view.totalLabel).toBe('1 result')
    model.setQuery('the')
    await model.submit()
    expect(model.view.totalLabel).toBe('3 results')
    model.setQuery('leviathan')
    await model.submit()
    expect(model.view.totalLabel).toBe('0 results')
  })

  it('goes back to idle when an emptied query is submitted', async () => {
    const { model } = harness()
    model.setQuery('vine')
    await model.submit()
    model.setQuery('   ')
    await model.submit()
    expect(model.view.status).toBe('idle')
    expect(model.view.books).toEqual([])
  })

  it('reports having nothing installed to search', async () => {
    const { model, searches } = harness({
      translations: [],
      fallbackTranslationId: null,
      content: {},
    })
    model.setQuery('vine')
    await model.submit()
    expect(model.view.status).toBe('no-translation')
    expect(model.view.translationLabel).toBeNull()
    expect(searches).toEqual([])
  })

  it('shows the search running before its results land', async () => {
    const { model } = harness()
    model.setQuery('vine')
    const running = model.submit()
    expect(model.view.status).toBe('searching')
    await running
    expect(model.view.status).toBe('ok')
  })

  it('shows the module being indexed before the first search’s results', async () => {
    const { model } = harness()
    const seen: string[] = []
    model.subscribe(() => seen.push(model.view.status))
    model.setQuery('vine')
    await model.submit()
    expect(seen).toContain('indexing')
    expect(model.view.status).toBe('ok')
    expect(model.view.indexing).toBeNull()
  })

  it('shows how far the indexing has got', async () => {
    const { model } = harness()
    const progress: (number | null)[] = []
    model.subscribe(() => progress.push(model.view.indexing?.done ?? null))
    model.setQuery('vine')
    await model.submit()
    expect(progress).toContain(0)
    expect(progress).toContain(BOOKS.length)
  })

  it('indexes only once, however many queries are submitted', async () => {
    const { model } = harness()
    model.setQuery('vine')
    await model.submit()
    const seen: string[] = []
    model.subscribe(() => seen.push(model.view.status))
    model.setQuery('earth')
    await model.submit()
    expect(seen).not.toContain('indexing')
    expect(labels(model)).toEqual(['Genesis 1:1', 'Genesis 1:2'])
  })

  it('keeps only the newest submission’s results', async () => {
    const { model } = harness()
    model.setQuery('vine')
    const first = model.submit()
    model.setQuery('formless')
    const second = model.submit()
    await Promise.all([first, second])
    expect(labels(model)).toEqual(['Genesis 1:2'])
    expect(model.view.submittedQuery).toBe('formless')
  })

  it('opens an activated hit at that verse in the searched translation', async () => {
    const { model, opened } = harness()
    model.setQuery('vine')
    await model.submit()
    model.openHit(model.view.books[0].hits[0])
    expect(opened).toEqual([
      {
        reference: {
          book: 43,
          ranges: [
            { startId: makeVerseId(43, 15, 1), endId: makeVerseId(43, 15, 1) },
          ],
        },
        translationId: 'web',
        options: {
          emphasis: [
            { verseId: makeVerseId(43, 15, 1), start: 14, end: 18 },
          ],
        },
      },
    ])
  })

  it('passes the new-pane request through to the reader', async () => {
    const { model, opened } = harness()
    model.setQuery('vine')
    await model.submit()
    model.openHit(model.view.books[0].hits[0], { newPane: true })
    expect(opened[0].options).toEqual({
      newPane: true,
      emphasis: [{ verseId: makeVerseId(43, 15, 1), start: 14, end: 18 }],
    })
  })

  it('keeps its query and results while hits are opened', async () => {
    const { model } = harness()
    model.setQuery('love')
    await model.submit()
    model.openHit(model.view.books[0].hits[0])
    model.openHit(model.view.books[0].hits[1])
    expect(model.view.query).toBe('love')
    expect(labels(model)).toEqual(['John 15:9', 'John 15:12'])
  })

  it('tells its subscribers whenever the view changes', async () => {
    const { model } = harness()
    let notifications = 0
    const unsubscribe = model.subscribe(() => {
      notifications += 1
    })
    model.setQuery('vine')
    await model.submit()
    expect(notifications).toBeGreaterThan(1)
    const settled = notifications
    unsubscribe()
    model.setQuery('other')
    expect(notifications).toBe(settled)
  })
})

const LONG_BOOK_HITS = HITS_SHOWN_PER_BOOK + 4

const longHarness = () =>
  harness({
    content: {
      web: {
        1: verses(1, 1, {
          1: 'In the beginning God created the heavens and the earth.',
        }),
        43: verses(
          43,
          15,
          Object.fromEntries(
            Array.from({ length: LONG_BOOK_HITS }, (_, index) => [
              index + 1,
              'I am the vine.',
            ]),
          ),
        ),
      },
    },
  })

const group = (model: SearchPaneModel, book: number) => {
  const found = model.view.books.find((candidate) => candidate.book === book)
  if (found === undefined) throw new Error(`no group for book ${book}`)
  return found
}

describe('SearchPaneModel result list', () => {
  it('shows the total across every book beside the groups', async () => {
    const { model } = longHarness()
    model.setQuery('the')
    await model.submit()
    expect(model.view.totalHits).toBe(LONG_BOOK_HITS + 1)
    expect(model.view.books).toHaveLength(2)
  })

  it('shows a long group up to the cap, saying how many more it hides', async () => {
    const { model } = longHarness()
    model.setQuery('the')
    await model.submit()
    expect(group(model, 43).hits).toHaveLength(HITS_SHOWN_PER_BOOK)
    expect(group(model, 43).hiddenHits).toBe(4)
    expect(group(model, 43).count).toBe(LONG_BOOK_HITS)
    expect(group(model, 1).hiddenHits).toBe(0)
  })

  it('reveals the rest of a capped group when it is expanded', async () => {
    const { model } = longHarness()
    model.setQuery('the')
    await model.submit()
    model.expandBookHits(43)
    expect(group(model, 43).hits).toHaveLength(LONG_BOOK_HITS)
    expect(group(model, 43).hiddenHits).toBe(0)
  })

  it('collapses and expands a group, keeping its count either way', async () => {
    const { model } = longHarness()
    model.setQuery('the')
    await model.submit()
    model.toggleBookCollapsed(43)
    expect(group(model, 43).collapsed).toBe(true)
    expect(group(model, 43).hits).toEqual([])
    expect(group(model, 43).count).toBe(LONG_BOOK_HITS)
    expect(model.view.totalHits).toBe(LONG_BOOK_HITS + 1)
    model.toggleBookCollapsed(43)
    expect(group(model, 43).collapsed).toBe(false)
    expect(group(model, 43).hits).toHaveLength(HITS_SHOWN_PER_BOOK)
  })

  it('collapses one group without touching the others', async () => {
    const { model } = longHarness()
    model.setQuery('the')
    await model.submit()
    model.toggleBookCollapsed(1)
    expect(group(model, 1).collapsed).toBe(true)
    expect(group(model, 43).collapsed).toBe(false)
  })

  it('tells its subscribers when a group is collapsed or expanded', async () => {
    const { model } = longHarness()
    model.setQuery('the')
    await model.submit()
    let notifications = 0
    model.subscribe(() => {
      notifications += 1
    })
    model.toggleBookCollapsed(43)
    model.expandBookHits(43)
    expect(notifications).toBe(2)
  })

  it('starts a new search with every group expanded and capped again', async () => {
    const { model } = longHarness()
    model.setQuery('the')
    await model.submit()
    model.toggleBookCollapsed(1)
    model.expandBookHits(43)
    await model.submit()
    expect(group(model, 1).collapsed).toBe(false)
    expect(group(model, 43).hits).toHaveLength(HITS_SHOWN_PER_BOOK)
  })

  it('remembers no collapse or expansion beyond the pane', async () => {
    const { model, stored } = longHarness()
    model.setQuery('the')
    await model.submit()
    model.toggleBookCollapsed(43)
    model.expandBookHits(1)
    expect(stored()).toEqual(defaultStoredSearchScope())
  })
})

const scopedHarness = () =>
  harness({
    translations: [
      { id: 'web', label: 'WEB' },
      { id: 'kjv', label: 'KJV' },
    ],
    books: [HUMILITY_BOOK_OPTION],
    content: { web: WEB_CONTENT, kjv: WEB_CONTENT, 'hum-m1895': HUMILITY_CONTENT },
    bookNumbers: { 'hum-m1895': 101 },
  })

describe('SearchPaneModel scope', () => {
  beforeEach(installHumilityBook)
  afterEach(uninstallHumilityBook)

  it('offers every installed translation, one of them chosen', () => {
    const { model } = scopedHarness()
    expect(model.view.scope.translations).toEqual([
      { id: 'web', label: 'WEB' },
      { id: 'kjv', label: 'KJV' },
    ])
    expect(model.view.scope.translationId).toBe('web')
  })

  it('starts on the Fallback Translation, both testaments and every book', () => {
    const { model } = scopedHarness()
    expect(model.view.scope.testament).toBe('all')
    expect(model.view.scope.books).toEqual([
      { ...HUMILITY_BOOK_OPTION, selected: true },
    ])
  })

  it('searches the chosen translation instead of the fallback', async () => {
    const { model, searchedModules } = scopedHarness()
    model.chooseTranslation('kjv')
    expect(model.view.translationLabel).toBe('KJV')
    model.setQuery('vine')
    await model.submit()
    expect(searchedModules()).toEqual(['kjv', 'hum-m1895'])
  })

  it('fans out only over the modules the scope selects', async () => {
    const { model, searchedModules } = scopedHarness()
    model.toggleBook('hum-m1895')
    model.setQuery('humility')
    await model.submit()
    expect(searchedModules()).toEqual(['web'])
    expect(model.view.books).toEqual([])
  })

  it('shows a book’s paragraph hits under the book, with the matched words emphasized', async () => {
    const { model } = scopedHarness()
    model.setQuery('humility')
    await model.submit()
    expect(bookSummary(model)).toEqual([{ name: 'Humility', count: 2 }])
    expect(labels(model)).toEqual([
      'Humility ch. 1, par. 2',
      'Humility ch. 2, par. 1',
    ])
    expect(model.view.books[0].hits[0].segments).toEqual([
      { text: 'Humility', matched: true },
      { text: ' is the only soil in which the graces take root.', matched: false },
    ])
  })

  it('opens a book hit at that paragraph, in the book’s own edition', async () => {
    const { model, opened } = scopedHarness()
    model.setQuery('humility')
    await model.submit()
    model.openHit(model.view.books[0].hits[0], { newPane: true })
    expect(opened).toEqual([
      {
        reference: {
          book: 101,
          ranges: [
            { startId: makeVerseId(101, 1, 2), endId: makeVerseId(101, 1, 2) },
          ],
        },
        translationId: null,
        options: {
          newPane: true,
          emphasis: [{ verseId: makeVerseId(101, 1, 2), start: 0, end: 8 }],
        },
      },
    ])
  })

  it('presents scripture and book hits together in Canonical Grid order', async () => {
    const { model } = scopedHarness()
    model.setQuery('the')
    await model.submit()
    expect(bookSummary(model).map((group) => group.name)).toEqual([
      'Genesis',
      'John',
      'Humility',
    ])
  })

  it('keeps only Old Testament hits when the scope says so', async () => {
    const { model } = scopedHarness()
    model.chooseTestament('ot')
    model.setQuery('the')
    await model.submit()
    expect(bookSummary(model).map((group) => group.name)).toEqual([
      'Genesis',
      'Humility',
    ])
  })

  it('keeps only New Testament hits when the scope says so', async () => {
    const { model } = scopedHarness()
    model.chooseTestament('nt')
    model.setQuery('the')
    await model.submit()
    expect(bookSummary(model).map((group) => group.name)).toEqual([
      'John',
      'Humility',
    ])
  })

  it('remembers every choice the picker makes', () => {
    const { model, stored } = scopedHarness()
    model.chooseTranslation('kjv')
    model.chooseTestament('nt')
    model.toggleBook('hum-m1895')
    expect(stored()).toEqual({
      translationId: 'kjv',
      testament: 'nt',
      excludedBookIds: ['hum-m1895'],
    })
  })

  it('remembers nothing of the query it ran or the hits it found', async () => {
    const { model, stored } = scopedHarness()
    model.setQuery('vine')
    await model.submit()
    expect(model.view.totalHits).toBeGreaterThan(0)
    expect(stored()).toEqual(defaultStoredSearchScope())
  })

  it('searches books even with no translation installed', async () => {
    const { model, searchedModules } = harness({
      translations: [],
      fallbackTranslationId: null,
      books: [HUMILITY_BOOK_OPTION],
      content: { 'hum-m1895': HUMILITY_CONTENT },
      bookNumbers: { 'hum-m1895': 101 },
    })
    model.setQuery('humility')
    await model.submit()
    expect(searchedModules()).toEqual(['hum-m1895'])
    expect(model.view.status).toBe('ok')
  })
})
