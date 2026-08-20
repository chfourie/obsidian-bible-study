import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import {
  HITS_SHOWN_PER_BOOK,
  bookViews,
  emphasizedSegments,
  groupHitsByBook,
} from './search-results'
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

  it('keeps the matched spans, so the reader can emphasize the same words', () => {
    const [group] = groupHitsByBook([
      {
        verseId: makeVerseId(43, 15, 1),
        text: 'I am the true vine.',
        spans: [{ start: 14, end: 18 }],
      },
    ])
    expect(group.hits[0].spans).toEqual([{ start: 14, end: 18 }])
  })

  it('has no groups for no hits', () => {
    expect(groupHitsByBook([])).toEqual([])
  })
})

const johnHits = (count: number): SearchHit[] =>
  Array.from({ length: count }, (_, index) =>
    hit(makeVerseId(43, 15, index + 1), 'I am the vine.'),
  )

const johnGroups = (count: number) => groupHitsByBook(johnHits(count))

describe('bookViews', () => {
  it('shows every hit of a group within the cap', () => {
    const [view] = bookViews(johnGroups(3), new Set(), new Set())
    expect(view.hits).toHaveLength(3)
    expect(view.count).toBe(3)
    expect(view.hiddenHits).toBe(0)
    expect(view.collapsed).toBe(false)
  })

  it('shows the cap and hides the rest of a longer group', () => {
    const [view] = bookViews(
      johnGroups(HITS_SHOWN_PER_BOOK + 4),
      new Set(),
      new Set(),
    )
    expect(view.hits).toHaveLength(HITS_SHOWN_PER_BOOK)
    expect(view.count).toBe(HITS_SHOWN_PER_BOOK + 4)
    expect(view.hiddenHits).toBe(4)
  })

  it('shows every hit of an expanded group', () => {
    const [view] = bookViews(
      johnGroups(HITS_SHOWN_PER_BOOK + 4),
      new Set(),
      new Set([43]),
    )
    expect(view.hits).toHaveLength(HITS_SHOWN_PER_BOOK + 4)
    expect(view.hiddenHits).toBe(0)
  })

  it('shows no hits of a collapsed group, and still counts them', () => {
    const [view] = bookViews(johnGroups(3), new Set([43]), new Set())
    expect(view.collapsed).toBe(true)
    expect(view.hits).toEqual([])
    expect(view.count).toBe(3)
    expect(view.hiddenHits).toBe(0)
  })

  it('collapses a group whose hits were expanded', () => {
    const [view] = bookViews(
      johnGroups(HITS_SHOWN_PER_BOOK + 4),
      new Set([43]),
      new Set([43]),
    )
    expect(view.hits).toEqual([])
    expect(view.count).toBe(HITS_SHOWN_PER_BOOK + 4)
  })

  it('leaves the groups it is given otherwise as they are', () => {
    const groups = groupHitsByBook([
      hit(makeVerseId(1, 1, 1), 'In the beginning'),
      hit(makeVerseId(43, 15, 1), 'I am the true vine.'),
    ])
    expect(bookViews(groups, new Set(), new Set()).map((view) => view.name)).toEqual(
      ['Genesis', 'John'],
    )
  })
})
