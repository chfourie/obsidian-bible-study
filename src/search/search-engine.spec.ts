import { describe, expect, it } from 'vitest'
import {
  fakeSearchIndexSource,
  WEB_CONTENT,
  type FakeSearchIndexSource,
} from '../../tests/fixtures/fake-search-index-source'
import type { BookContent } from '../modules'
import { makeVerseId } from '../reference'
import { SearchEngine } from './search-engine'
import type { IndexBuildProgress } from './search-index-store'
import { parseSearchQuery } from './search-query'

const BOOKS = [1, 2, 43]

const john15 = (): BookContent => ({
  [makeVerseId(43, 15, 3)]: 'Already you are clean.',
  [makeVerseId(43, 15, 1)]: 'I am the true vine.',
  [makeVerseId(43, 15, 2)]: {
    text: 'He takes away every branch that bears no fruit.',
  },
})

const engineOver = (
  source: FakeSearchIndexSource = fakeSearchIndexSource(),
  books: readonly number[] = BOOKS,
) => ({ source, engine: new SearchEngine(source, books) })

const verses = async (
  engine: SearchEngine,
  query: string,
  moduleId = 'web',
): Promise<number[]> =>
  (await engine.search(moduleId, parseSearchQuery(query))).map(
    (hit) => hit.verseId,
  )

describe('SearchEngine', () => {
  it('returns the atoms whose text satisfies the query', async () => {
    const { engine } = engineOver()
    expect(
      await engine.search('web', parseSearchQuery('vine')),
    ).toEqual([
      {
        verseId: makeVerseId(43, 15, 1),
        text: 'I am the true vine.',
        spans: [{ start: 14, end: 18 }],
      },
    ])
  })

  it('reads structured verse content as its text', async () => {
    const { engine } = engineOver(fakeSearchIndexSource({ web: { 43: john15() } }))
    expect(await verses(engine, 'fruit')).toEqual([makeVerseId(43, 15, 2)])
  })

  it('orders a book’s hits by verse id, whatever order they are stored in', async () => {
    const { engine } = engineOver(fakeSearchIndexSource({ web: { 43: john15() } }))
    expect(await verses(engine, 'a')).toEqual([
      makeVerseId(43, 15, 1),
      makeVerseId(43, 15, 2),
      makeVerseId(43, 15, 3),
    ])
  })

  it('answers in the order the books were indexed, skipping missing ones', async () => {
    const { engine, source } = engineOver()
    expect(await verses(engine, 'the')).toEqual([
      makeVerseId(1, 1, 1),
      makeVerseId(1, 1, 2),
      makeVerseId(43, 15, 1),
    ])
    expect(source.contentReads.slice(0, 3)).toEqual(['web/1', 'web/2', 'web/43'])
  })

  it('reads a hit’s text back from the module, once per book holding one', async () => {
    const { engine, source } = engineOver()
    await engine.indexModule('web')
    source.forget()
    expect(
      await engine.search('web', parseSearchQuery('the')),
    ).toEqual([
      {
        verseId: makeVerseId(1, 1, 1),
        text: 'In the beginning God created the heavens and the earth.',
        spans: [
          { start: 3, end: 6 },
          { start: 29, end: 32 },
          { start: 45, end: 48 },
        ],
      },
      {
        verseId: makeVerseId(1, 1, 2),
        text: 'The earth was formless and empty.',
        spans: [{ start: 0, end: 3 }],
      },
      {
        verseId: makeVerseId(43, 15, 1),
        text: 'I am the true vine.',
        spans: [{ start: 5, end: 8 }],
      },
    ])
    expect(source.contentReads).toEqual(['web/1', 'web/43'])
  })

  it('reads no content for a book the query found nothing in', async () => {
    const { engine, source } = engineOver()
    await engine.indexModule('web')
    source.forget()
    await verses(engine, 'vine')
    expect(source.contentReads).toEqual(['web/43'])
  })

  it('finds nothing in a module that is not installed, and indexes none', async () => {
    const { engine, source } = engineOver()
    expect(await verses(engine, 'vine', 'kjv')).toEqual([])
    expect(source.indexWrites).toEqual([])
  })

  it('reads no content at all for a query with no words', async () => {
    const { engine, source } = engineOver()
    expect(await engine.search('web', parseSearchQuery('""'))).toEqual([])
    expect(source.contentReads).toEqual([])
    expect(source.indexWrites).toEqual([])
  })

  it('requires every word of the query in one atom', async () => {
    const { engine } = engineOver()
    expect(await verses(engine, 'God created')).toEqual([makeVerseId(1, 1, 1)])
    expect(await verses(engine, 'God vine')).toEqual([])
  })

  it('requires a quoted phrase to appear contiguously', async () => {
    const { engine } = engineOver()
    expect(await verses(engine, '"in the beginning"')).toEqual([
      makeVerseId(1, 1, 1),
    ])
    expect(await verses(engine, '"in the earth"')).toEqual([])
  })

  it('builds the index once and answers later searches from it', async () => {
    const { engine, source } = engineOver()
    await verses(engine, 'vine')
    expect(source.indexWrites).toEqual(['web'])
    source.forget()
    expect(await verses(engine, 'earth')).toEqual([
      makeVerseId(1, 1, 1),
      makeVerseId(1, 1, 2),
    ])
    expect(source.contentReads).toEqual(['web/1'])
    expect(source.indexWrites).toEqual([])
  })

  it('answers from the persisted index without rebuilding it', async () => {
    const { source } = engineOver()
    await new SearchEngine(source, BOOKS).search('web', parseSearchQuery('vine'))
    source.forget()
    const later = new SearchEngine(source, BOOKS)
    expect(await verses(later, 'vine')).toEqual([makeVerseId(43, 15, 1)])
    expect(source.contentReads).toEqual(['web/43'])
    expect(source.indexWrites).toEqual([])
  })

  it('rebuilds the index whole when the module has been downloaded again', async () => {
    const { engine, source } = engineOver()
    await verses(engine, 'vine')
    source.forget()
    source.redownload('web', 'sha-web-2', {
      43: { [makeVerseId(43, 15, 5)]: 'I am the vine, you are the branches.' },
    })
    expect(await verses(engine, 'branches')).toEqual([makeVerseId(43, 15, 5)])
    expect(source.contentReads.slice(0, 3)).toEqual(['web/1', 'web/2', 'web/43'])
    expect(source.indexWrites).toEqual(['web'])
  })

  it('rebuilds the index whole when its format is out of date', async () => {
    const { source } = engineOver()
    await new SearchEngine(source, BOOKS).search('web', parseSearchQuery('vine'))
    const stored = JSON.parse((await source.readSearchIndex('web')) ?? '') as {
      formatVersion: number
    }
    await source.writeSearchIndex(
      'web',
      JSON.stringify({ ...stored, formatVersion: 0 }),
    )
    source.forget()
    const later = new SearchEngine(source, BOOKS)
    expect(await verses(later, 'vine')).toEqual([makeVerseId(43, 15, 1)])
    expect(source.contentReads.slice(0, 3)).toEqual(['web/1', 'web/2', 'web/43'])
    expect(source.indexWrites).toEqual(['web'])
  })

  it('reports indexing progress only while a build is running', async () => {
    const { engine, source } = engineOver()
    const progress: IndexBuildProgress[] = []
    await engine.search('web', parseSearchQuery('vine'), (step) =>
      progress.push(step),
    )
    expect(progress[0]).toEqual({ done: 0, total: 3 })
    expect(progress[progress.length - 1]).toEqual({ done: 3, total: 3 })
    source.forget()
    const later: IndexBuildProgress[] = []
    await engine.search('web', parseSearchQuery('earth'), (step) =>
      later.push(step),
    )
    expect(later).toEqual([])
  })

  it('indexes a book module over its own book alone', async () => {
    const source = fakeSearchIndexSource(
      {
        'hum-m1895': {
          101: {
            [makeVerseId(101, 3, 2)]:
              'Humility is the only soil in which the graces root.',
          },
        },
      },
      { 'hum-m1895': 'sha-hum-1' },
      { 'hum-m1895': 101 },
    )
    const engine = new SearchEngine(source, BOOKS)
    expect(await verses(engine, 'graces', 'hum-m1895')).toEqual([
      makeVerseId(101, 3, 2),
    ])
    expect(source.contentReads.slice(0, 1)).toEqual(['hum-m1895/101'])
  })

  it('indexes each module it is asked about separately', async () => {
    const { engine, source } = engineOver(
      fakeSearchIndexSource(
        { web: WEB_CONTENT, kjv: { 43: john15() } },
        { web: 'sha-web-1', kjv: 'sha-kjv-1' },
      ),
    )
    expect(await verses(engine, 'vine', 'web')).toEqual([makeVerseId(43, 15, 1)])
    expect(await verses(engine, 'fruit', 'kjv')).toEqual([makeVerseId(43, 15, 2)])
    expect(source.indexWrites).toEqual(['web', 'kjv'])
  })
})

describe('SearchEngine eager indexing', () => {
  it('builds and persists a module’s index ahead of any search', async () => {
    const { engine, source } = engineOver()

    await engine.indexModule('web')

    expect(source.indexWrites).toEqual(['web'])
    expect(source.contentReads).toEqual(['web/1', 'web/2', 'web/43'])
  })

  it('leaves the first search with nothing to build and no progress to report', async () => {
    const { engine, source } = engineOver()
    await engine.indexModule('web')
    source.forget()

    const progress: IndexBuildProgress[] = []
    expect(
      (await engine.search('web', parseSearchQuery('vine'), (step) =>
        progress.push(step),
      )).map((hit) => hit.verseId),
    ).toEqual([makeVerseId(43, 15, 1)])
    expect(progress).toEqual([])
    expect(source.contentReads).toEqual(['web/43'])
    expect(source.indexWrites).toEqual([])
  })

  it('rebuilds against the fresh checksum when a module is downloaded again', async () => {
    const { engine, source } = engineOver()
    await engine.indexModule('web')
    source.redownload('web', 'sha-web-2', {
      43: { [makeVerseId(43, 15, 5)]: 'I am the vine, you are the branches.' },
    })
    source.forget()

    await engine.indexModule('web')

    expect(source.indexWrites).toEqual(['web'])
    const progress: IndexBuildProgress[] = []
    expect(
      (await engine.search('web', parseSearchQuery('branches'), (step) =>
        progress.push(step),
      )).map((hit) => hit.verseId),
    ).toEqual([makeVerseId(43, 15, 5)])
    expect(progress).toEqual([])
  })

  it('indexes a module that is not installed as nothing', async () => {
    const { engine, source } = engineOver()

    await engine.indexModule('nope')

    expect(source.indexWrites).toEqual([])
  })
})
