import { describe, expect, it } from 'vitest'
import { FakeSearchIndexSource } from '../../tests/fixtures/fake-search-index-source'
import type { NavigationOptions } from '../contracts'
import type { BookContent } from '../modules'
import { BOOKS, makeVerseId, type Reference } from '../reference'
import { SearchEngine } from './search-engine'
import {
  SearchPaneModel,
  type SearchPaneDeps,
  type SearchTranslation,
} from './search-pane-model'
import type { SearchQuery } from './search-query'

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

type Opened = {
  reference: Reference
  translationId: string
  options: NavigationOptions | undefined
}

const harness = (
  translation: SearchTranslation | null = { id: 'web', label: 'WEB' },
  content: Record<string, Record<number, BookContent>> = { web: WEB_CONTENT },
) => {
  const source = new FakeSearchIndexSource(content)
  const engine = new SearchEngine(
    source,
    BOOKS.map((book) => book.id),
  )
  const opened: Opened[] = []
  const searches: SearchQuery[] = []
  const deps: SearchPaneDeps = {
    translation: () => translation,
    search: (moduleId, query, onProgress) => {
      searches.push(query)
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
    reads: source.contentReads,
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
    const { model } = harness({ id: 'esp', label: 'ESP' }, {
      esp: { 43: verses(43, 15, { 1: 'Yo soy la vid verdadéra.' }) },
    })
    model.setQuery('VERDADERA')
    await model.submit()
    expect(labels(model)).toEqual(['John 15:1'])
  })

  it('folds non-Latin scripts the same way', async () => {
    const { model } = harness({ id: 'grk', label: 'GRK' }, {
      grk: { 43: verses(43, 1, { 1: 'Ἐν ἀρχῇ ἦν ὁ Λόγος' }) },
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

  it('goes back to idle when an emptied query is submitted', async () => {
    const { model } = harness()
    model.setQuery('vine')
    await model.submit()
    model.setQuery('   ')
    await model.submit()
    expect(model.view.status).toBe('idle')
    expect(model.view.books).toEqual([])
  })

  it('reports having no translation to search', async () => {
    const { model, searches } = harness(null)
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
        options: undefined,
      },
    ])
  })

  it('passes the new-pane request through to the reader', async () => {
    const { model, opened } = harness()
    model.setQuery('vine')
    await model.submit()
    model.openHit(model.view.books[0].hits[0], { newPane: true })
    expect(opened[0].options).toEqual({ newPane: true })
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
