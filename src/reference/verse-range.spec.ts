import { describe, expect, it } from 'vitest'
import {
  enumerateVerseIds,
  mergeRanges,
  rangeContains,
  rangesOverlap,
  referencesIntersect,
} from './verse-range'
import { makeVerseId } from './verse-id'

const range = (start: number, end: number) => ({ startId: start, endId: end })
const john = (chapter: number, verse: number) => makeVerseId(43, chapter, verse)

describe('rangesOverlap', () => {
  it('detects overlapping ranges', () => {
    expect(
      rangesOverlap(
        range(john(15, 1), john(15, 17)),
        range(john(15, 17), john(15, 20)),
      ),
    ).toBe(true)
    expect(
      rangesOverlap(
        range(john(15, 1), john(16, 4)),
        range(john(15, 26), john(15, 26)),
      ),
    ).toBe(true)
  })

  it('rejects disjoint ranges', () => {
    expect(
      rangesOverlap(
        range(john(15, 1), john(15, 17)),
        range(john(15, 18), john(15, 27)),
      ),
    ).toBe(false)
  })
})

describe('rangeContains', () => {
  it('contains its endpoints and interior', () => {
    const r = range(john(15, 4), john(15, 6))
    expect(rangeContains(r, john(15, 4))).toBe(true)
    expect(rangeContains(r, john(15, 5))).toBe(true)
    expect(rangeContains(r, john(15, 6))).toBe(true)
  })

  it('excludes ids outside the span', () => {
    const r = range(john(15, 4), john(15, 6))
    expect(rangeContains(r, john(15, 3))).toBe(false)
    expect(rangeContains(r, john(15, 7))).toBe(false)
  })
})

describe('mergeRanges', () => {
  it('sorts ranges by start id', () => {
    expect(
      mergeRanges([
        range(john(15, 9), john(15, 9)),
        range(john(15, 4), john(15, 6)),
      ]),
    ).toEqual([range(john(15, 4), john(15, 6)), range(john(15, 9), john(15, 9))])
  })

  it('merges overlapping ranges', () => {
    expect(
      mergeRanges([
        range(john(15, 1), john(15, 10)),
        range(john(15, 5), john(15, 17)),
      ]),
    ).toEqual([range(john(15, 1), john(15, 17))])
  })

  it('merges adjacent ranges, including across a chapter boundary', () => {
    expect(
      mergeRanges([
        range(john(15, 4), john(15, 6)),
        range(john(15, 7), john(15, 9)),
      ]),
    ).toEqual([range(john(15, 4), john(15, 9))])
    expect(
      mergeRanges([
        range(john(15, 20), john(15, 27)),
        range(john(16, 1), john(16, 4)),
      ]),
    ).toEqual([range(john(15, 20), john(16, 4))])
  })

  it('collapses duplicate ranges', () => {
    expect(
      mergeRanges([
        range(john(15, 4), john(15, 4)),
        range(john(15, 4), john(15, 4)),
      ]),
    ).toEqual([range(john(15, 4), john(15, 4))])
  })

  it('keeps non-adjacent ranges apart', () => {
    expect(
      mergeRanges([
        range(john(15, 4), john(15, 6)),
        range(john(15, 9), john(15, 9)),
      ]),
    ).toEqual([range(john(15, 4), john(15, 6)), range(john(15, 9), john(15, 9))])
  })
})

describe('referencesIntersect', () => {
  it('intersects when any ranges share a verse', () => {
    expect(
      referencesIntersect(
        { book: 43, ranges: [range(john(15, 1), john(15, 17))] },
        { book: 43, ranges: [range(john(15, 17), john(15, 20))] },
      ),
    ).toBe(true)
  })

  it('never intersects across books', () => {
    expect(
      referencesIntersect(
        { book: 43, ranges: [range(john(15, 1), john(15, 17))] },
        { book: 42, ranges: [range(makeVerseId(42, 15, 1), makeVerseId(42, 15, 17))] },
      ),
    ).toBe(false)
  })

  it('rejects disjoint ranges in the same book', () => {
    expect(
      referencesIntersect(
        { book: 43, ranges: [range(john(15, 1), john(15, 17))] },
        { book: 43, ranges: [range(john(15, 18), john(15, 27))] },
      ),
    ).toBe(false)
  })
})

describe('enumerateVerseIds', () => {
  it('lists every verse in an intra-chapter range', () => {
    expect(enumerateVerseIds(range(john(15, 4), john(15, 6)))).toEqual([
      john(15, 4),
      john(15, 5),
      john(15, 6),
    ])
  })

  it('skips non-existent ids across a chapter boundary', () => {
    expect(enumerateVerseIds(range(john(15, 26), john(16, 2)))).toEqual([
      john(15, 26),
      john(15, 27),
      john(16, 1),
      john(16, 2),
    ])
  })

  it('lists a single-verse range as one id', () => {
    expect(enumerateVerseIds(range(john(15, 4), john(15, 4)))).toEqual([
      john(15, 4),
    ])
  })
})
