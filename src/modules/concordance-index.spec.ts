import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import {
  buildConcordanceIndex,
  occurrencesOf,
  totalOccurrences,
} from './concordance-index'
import type { BookContent } from './normalized-module'

const genesis = (content: BookContent): Map<number, BookContent> =>
  new Map([[1, content]])

describe('buildConcordanceIndex', () => {
  it('counts a verse once per tag span the family is tagged on', () => {
    const index = buildConcordanceIndex(
      genesis({
        [makeVerseId(1, 1, 1)]: {
          text: 'God created, and God saw.',
          tags: [
            { start: 0, end: 3, strongs: ['H0430'] },
            { start: 17, end: 20, strongs: ['H0430'] },
          ],
        },
        [makeVerseId(1, 1, 2)]: {
          text: 'And the Spirit of God moved.',
          tags: [{ start: 18, end: 21, strongs: ['H0430'] }],
        },
      }),
    )

    expect(occurrencesOf(index, 'H0430')).toEqual([
      { verseId: makeVerseId(1, 1, 1), count: 2 },
      { verseId: makeVerseId(1, 1, 2), count: 1 },
    ])
    expect(totalOccurrences(occurrencesOf(index, 'H0430'))).toBe(3)
  })

  it('counts one span stacking a family twice as the single occurrence it is', () => {
    const index = buildConcordanceIndex(
      genesis({
        [makeVerseId(1, 1, 1)]: {
          text: 'God created.',
          tags: [{ start: 0, end: 3, strongs: ['H0430', 'H0430B'] }],
        },
      }),
    )

    expect(occurrencesOf(index, 'H0430')).toEqual([
      { verseId: makeVerseId(1, 1, 1), count: 1 },
    ])
  })

  it('stores a singly tagged verse as its bare verse id', () => {
    const index = buildConcordanceIndex(
      genesis({
        [makeVerseId(1, 1, 1)]: {
          text: 'God created.',
          tags: [{ start: 0, end: 3, strongs: ['H0430'] }],
        },
      }),
    )

    expect(index['H0430']).toEqual([makeVerseId(1, 1, 1)])
  })

  it('reads an index stored before occurrences were counted', () => {
    const index = { H0430: [makeVerseId(1, 1, 1), makeVerseId(1, 1, 2)] }

    expect(occurrencesOf(index, 'H0430B')).toEqual([
      { verseId: makeVerseId(1, 1, 1), count: 1 },
      { verseId: makeVerseId(1, 1, 2), count: 1 },
    ])
  })
})
