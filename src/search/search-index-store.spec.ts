import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import { fakeSearchIndexSource } from '../../tests/fixtures/fake-search-index-source'
import {
  buildAndPersistSearchIndex,
  loadSearchIndex,
  type IndexBuildProgress,
} from './search-index-store'
import {
  searchIndex,
  SEARCH_INDEX_FORMAT_VERSION,
  type SearchIndex,
} from './search-index'
import { parseSearchQuery } from './search-query'

const BOOKS = [1, 2, 43]

const IN_BOOK = 102

const IN_CONTENT = {
  [IN_BOOK]: {
    [makeVerseId(IN_BOOK, 1, 1)]: {
      text: 'He would not be told anything.',
      headings: [
        { text: 'PART TWO: Redemption of Man', level: 'part' as const },
      ],
    },
  },
}

const built = async (source = fakeSearchIndexSource()) =>
  buildAndPersistSearchIndex(source, 'web', BOOKS)

describe('buildAndPersistSearchIndex', () => {
  it('indexes the module’s atoms in the order the books are given', async () => {
    const index = await built()
    expect(index.verseIds).toEqual([
      makeVerseId(1, 1, 1),
      makeVerseId(1, 1, 2),
      makeVerseId(43, 15, 1),
    ])
  })

  it('stamps the index with the module’s source checksum', async () => {
    const index = await built()
    expect(index.sourceChecksum).toBe('sha-web-1')
    expect(index.formatVersion).toBe(SEARCH_INDEX_FORMAT_VERSION)
  })

  it('writes the index beside the module content', async () => {
    const source = fakeSearchIndexSource()
    const index = await built(source)
    const written = await source.readSearchIndex('web')
    expect(written).not.toBeNull()
    expect(JSON.parse(written ?? '') as SearchIndex).toEqual(index)
  })

  it('reports progress over the books as it reads them', async () => {
    const source = fakeSearchIndexSource()
    const progress: IndexBuildProgress[] = []
    await buildAndPersistSearchIndex(source, 'web', BOOKS, (step) =>
      progress.push(step),
    )
    expect(progress).toEqual([
      { done: 0, total: 3 },
      { done: 1, total: 3 },
      { done: 2, total: 3 },
      { done: 3, total: 3 },
    ])
  })

  it('indexes a Book paragraph together with its Headings', async () => {
    const source = fakeSearchIndexSource({ in: IN_CONTENT }, undefined, {
      in: IN_BOOK,
    })
    const index = await buildAndPersistSearchIndex(source, 'in', [IN_BOOK])
    expect(
      searchIndex(index, parseSearchQuery('redemption')).map(
        (hit) => hit.verseId,
      ),
    ).toEqual([makeVerseId(IN_BOOK, 1, 1)])
  })

  it('indexes an uninstalled module as nothing at all', async () => {
    const source = fakeSearchIndexSource()
    const index = await buildAndPersistSearchIndex(source, 'kjv', BOOKS)
    expect(index.verseIds).toEqual([])
    expect(index.sourceChecksum).toBe('')
  })
})

describe('loadSearchIndex', () => {
  it('finds no index for a module that has never been indexed', async () => {
    const source = fakeSearchIndexSource()
    expect(await loadSearchIndex(source, 'web', 'sha-web-1')).toBeNull()
  })

  it('loads back the index it persisted', async () => {
    const source = fakeSearchIndexSource()
    const index = await built(source)
    expect(await loadSearchIndex(source, 'web', 'sha-web-1')).toEqual(index)
  })

  it('rejects an index built from other module content', async () => {
    const source = fakeSearchIndexSource()
    await built(source)
    expect(await loadSearchIndex(source, 'web', 'sha-web-2')).toBeNull()
  })

  it('rejects an index written in an older format', async () => {
    const source = fakeSearchIndexSource()
    const index = await built(source)
    await source.writeSearchIndex(
      'web',
      JSON.stringify({ ...index, formatVersion: SEARCH_INDEX_FORMAT_VERSION - 1 }),
    )
    expect(await loadSearchIndex(source, 'web', 'sha-web-1')).toBeNull()
  })

  it('rejects the older format that carried a copy of the module’s text', async () => {
    const source = fakeSearchIndexSource()
    const index = await built(source)
    await source.writeSearchIndex(
      'web',
      JSON.stringify({
        ...index,
        formatVersion: 1,
        texts: ['In the beginning God created the heavens and the earth.'],
      }),
    )
    expect(await loadSearchIndex(source, 'web', 'sha-web-1')).toBeNull()
  })

  it('rejects the format that indexed a paragraph without its Headings', async () => {
    const source = fakeSearchIndexSource()
    const index = await built(source)
    await source.writeSearchIndex(
      'web',
      JSON.stringify({ ...index, formatVersion: 2 }),
    )
    expect(await loadSearchIndex(source, 'web', 'sha-web-1')).toBeNull()
  })

  it('rejects an index file that is not readable at all', async () => {
    const source = fakeSearchIndexSource()
    await source.writeSearchIndex('web', 'not json')
    expect(await loadSearchIndex(source, 'web', 'sha-web-1')).toBeNull()
  })
})
