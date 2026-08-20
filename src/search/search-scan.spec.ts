import { describe, expect, it } from 'vitest'
import type { BookContent } from '../modules'
import { makeVerseId } from '../reference'
import { parseSearchQuery } from './search-query'
import { scanModule, type SearchContentSource } from './search-scan'

const john15 = (): BookContent => ({
  [makeVerseId(43, 15, 3)]: 'Already you are clean.',
  [makeVerseId(43, 15, 1)]: 'I am the true vine.',
  [makeVerseId(43, 15, 2)]: {
    text: 'He takes away every branch that bears no fruit.',
  },
})

const gen1 = (): BookContent => ({
  [makeVerseId(1, 1, 1)]: 'In the beginning God created the heaven and earth.',
})

const fakeContent = (
  books: Record<number, BookContent> = { 1: gen1(), 43: john15() },
) => {
  const reads: number[] = []
  const source: SearchContentSource = {
    bookContent: async (moduleId, book) => {
      reads.push(book)
      return moduleId === 'web' ? (books[book] ?? null) : null
    },
  }
  return { source, reads }
}

describe('scanModule', () => {
  it('returns the atoms whose text satisfies the query', async () => {
    const { source } = fakeContent()
    const hits = await scanModule(source, 'web', [43], parseSearchQuery('vine'))
    expect(hits).toEqual([
      {
        verseId: makeVerseId(43, 15, 1),
        text: 'I am the true vine.',
        spans: [{ start: 14, end: 18 }],
      },
    ])
  })

  it('reads structured verse content as its text', async () => {
    const { source } = fakeContent()
    const hits = await scanModule(source, 'web', [43], parseSearchQuery('fruit'))
    expect(hits.map((hit) => hit.verseId)).toEqual([makeVerseId(43, 15, 2)])
  })

  it('orders a book’s hits by verse id, whatever order they are stored in', async () => {
    const { source } = fakeContent()
    const hits = await scanModule(source, 'web', [43], parseSearchQuery('a'))
    expect(hits.map((hit) => hit.verseId)).toEqual([
      makeVerseId(43, 15, 1),
      makeVerseId(43, 15, 2),
      makeVerseId(43, 15, 3),
    ])
  })

  it('scans the books in the order it is given them', async () => {
    const { source } = fakeContent()
    const hits = await scanModule(
      source,
      'web',
      [1, 43],
      parseSearchQuery('the'),
    )
    expect(hits.map((hit) => hit.verseId)).toEqual([
      makeVerseId(1, 1, 1),
      makeVerseId(43, 15, 1),
    ])
  })

  it('skips books the module has no content for', async () => {
    const { source } = fakeContent()
    const hits = await scanModule(
      source,
      'web',
      [2, 43],
      parseSearchQuery('vine'),
    )
    expect(hits).toHaveLength(1)
  })

  it('finds nothing in a module that is not installed', async () => {
    const { source } = fakeContent()
    const hits = await scanModule(source, 'kjv', [43], parseSearchQuery('vine'))
    expect(hits).toEqual([])
  })

  it('reads no content at all for a query with no words', async () => {
    const { source, reads } = fakeContent()
    expect(await scanModule(source, 'web', [1, 43], parseSearchQuery('""'))).toEqual([])
    expect(reads).toEqual([])
  })

  it('requires every word of the query in one atom', async () => {
    const { source } = fakeContent()
    const both = await scanModule(
      source,
      'web',
      [1, 43],
      parseSearchQuery('God created'),
    )
    expect(both.map((hit) => hit.verseId)).toEqual([makeVerseId(1, 1, 1)])
    expect(
      await scanModule(source, 'web', [1, 43], parseSearchQuery('God vine')),
    ).toEqual([])
  })
})
