import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import { emphasizedSegments, groupHitsByBook } from './search-results'
import type { SearchHit } from './search-scan'

const hit = (verseId: number, text: string): SearchHit => ({
  verseId,
  text,
  spans: [],
})

describe('emphasizedSegments', () => {
  it('splits the text into matched and unmatched runs', () => {
    expect(
      emphasizedSegments('I am the true vine.', [{ start: 14, end: 18 }]),
    ).toEqual([
      { text: 'I am the true ', matched: false },
      { text: 'vine', matched: true },
      { text: '.', matched: false },
    ])
  })

  it('leaves no empty run where a match opens or closes the text', () => {
    expect(emphasizedSegments('vine', [{ start: 0, end: 4 }])).toEqual([
      { text: 'vine', matched: true },
    ])
  })

  it('keeps every match apart', () => {
    expect(
      emphasizedSegments('love and love', [
        { start: 0, end: 4 },
        { start: 9, end: 13 },
      ]),
    ).toEqual([
      { text: 'love', matched: true },
      { text: ' and ', matched: false },
      { text: 'love', matched: true },
    ])
  })

  it('is the whole text unmatched when nothing matched', () => {
    expect(emphasizedSegments('love', [])).toEqual([
      { text: 'love', matched: false },
    ])
  })
})

describe('groupHitsByBook', () => {
  it('groups hits under their book, counting each group', () => {
    const groups = groupHitsByBook([
      hit(makeVerseId(1, 1, 1), 'In the beginning'),
      hit(makeVerseId(43, 15, 1), 'I am the true vine.'),
      hit(makeVerseId(43, 15, 5), 'I am the vine.'),
    ])
    expect(
      groups.map(({ book, name, count }) => ({ book, name, count })),
    ).toEqual([
      { book: 1, name: 'Genesis', count: 1 },
      { book: 43, name: 'John', count: 2 },
    ])
  })

  it('labels each hit by its own verse and carries a reference to it', () => {
    const [group] = groupHitsByBook([hit(makeVerseId(43, 15, 1), 'vine')])
    expect(group.hits[0].label).toBe('John 15:1')
    expect(group.hits[0].reference).toEqual({
      book: 43,
      ranges: [{ startId: makeVerseId(43, 15, 1), endId: makeVerseId(43, 15, 1) }],
    })
  })

  it('emphasizes the matched spans of each hit', () => {
    const [group] = groupHitsByBook([
      {
        verseId: makeVerseId(43, 15, 1),
        text: 'I am the true vine.',
        spans: [{ start: 14, end: 18 }],
      },
    ])
    expect(group.hits[0].segments).toEqual([
      { text: 'I am the true ', matched: false },
      { text: 'vine', matched: true },
      { text: '.', matched: false },
    ])
  })

  it('has no groups for no hits', () => {
    expect(groupHitsByBook([])).toEqual([])
  })
})
