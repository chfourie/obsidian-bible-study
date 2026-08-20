import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import {
  buildSearchIndex,
  isCurrentSearchIndex,
  searchIndex,
  SEARCH_INDEX_FORMAT_VERSION,
  type SearchIndex,
} from './search-index'
import { parseSearchQuery } from './search-query'
import type { ModuleAtom } from './search-scan'

const atom = (verse: number, text: string): ModuleAtom => ({
  verseId: makeVerseId(43, 15, verse),
  text,
})

const JOHN15: ModuleAtom[] = [
  atom(1, 'I am the true vine.'),
  atom(2, 'He takes away every branch that bears no fruit.'),
  atom(9, 'Even so I have loved you. Remain in my love.'),
  atom(12, 'This is my commandment, that you love one another.'),
]

const indexOf = (atoms: ModuleAtom[] = JOHN15, checksum = 'sha-1'): SearchIndex =>
  buildSearchIndex(atoms, checksum)

const verses = (index: SearchIndex, query: string): number[] =>
  searchIndex(index, parseSearchQuery(query)).map((hit) => hit.verseId)

describe('buildSearchIndex', () => {
  it('stamps the index with the format version and the module checksum', () => {
    const index = indexOf()
    expect(index.formatVersion).toBe(SEARCH_INDEX_FORMAT_VERSION)
    expect(index.sourceChecksum).toBe('sha-1')
  })

  it('holds its terms folded and sorted', () => {
    const index = indexOf([atom(1, 'Ánd the Vine, the vine.')])
    expect(index.terms).toEqual(['and', 'the', 'vine'])
  })

  it('survives a round trip through JSON', () => {
    const index = indexOf()
    const restored = JSON.parse(JSON.stringify(index)) as SearchIndex
    expect(verses(restored, 'vine')).toEqual([makeVerseId(43, 15, 1)])
  })
})

describe('isCurrentSearchIndex', () => {
  it('accepts an index stamped with this format and the module checksum', () => {
    expect(isCurrentSearchIndex(indexOf(), 'sha-1')).toBe(true)
  })

  it('rejects an index built from other module content', () => {
    expect(isCurrentSearchIndex(indexOf(), 'sha-2')).toBe(false)
  })

  it('rejects an index written in an older format', () => {
    const index = { ...indexOf(), formatVersion: SEARCH_INDEX_FORMAT_VERSION - 1 }
    expect(isCurrentSearchIndex(index, 'sha-1')).toBe(false)
  })
})

describe('searchIndex', () => {
  it('finds the atoms a word occurs in, in index order', () => {
    expect(verses(indexOf(), 'love')).toEqual([
      makeVerseId(43, 15, 9),
      makeVerseId(43, 15, 12),
    ])
  })

  it('matches a word as a prefix over the sorted terms', () => {
    expect(verses(indexOf(), 'bran')).toEqual([makeVerseId(43, 15, 2)])
    expect(verses(indexOf(), 'ranch')).toEqual([])
  })

  it('intersects postings so every word must be in one atom', () => {
    expect(verses(indexOf(), 'love remain')).toEqual([makeVerseId(43, 15, 9)])
    expect(verses(indexOf(), 'love vine')).toEqual([])
  })

  it('requires a quoted phrase to be adjacent', () => {
    expect(verses(indexOf(), '"the true vine"')).toEqual([
      makeVerseId(43, 15, 1),
    ])
    expect(verses(indexOf(), '"the vine"')).toEqual([])
  })

  it('folds case and diacritics on both sides', () => {
    const index = indexOf([atom(1, 'Yo soy la vid verdadéra.')])
    expect(verses(index, 'VERDADERA')).toEqual([makeVerseId(43, 15, 1)])
  })

  it('carries the atom text and the matched spans', () => {
    const hits = searchIndex(indexOf(), parseSearchQuery('true vine'))
    expect(hits).toEqual([
      {
        verseId: makeVerseId(43, 15, 1),
        text: 'I am the true vine.',
        spans: [
          { start: 9, end: 13 },
          { start: 14, end: 18 },
        ],
      },
    ])
  })

  it('emphasizes every occurrence of a matched word', () => {
    const hits = searchIndex(
      indexOf([atom(1, 'The vine, the vine.')]),
      parseSearchQuery('vine'),
    )
    expect(hits[0].spans).toEqual([
      { start: 4, end: 8 },
      { start: 14, end: 18 },
    ])
  })

  it('finds nothing for a query with no words', () => {
    expect(verses(indexOf(), '""')).toEqual([])
  })
})
