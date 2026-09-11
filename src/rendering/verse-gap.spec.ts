import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  HUMILITY_BOOK,
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import { makeVerseId, type Reference } from '../reference'
import { isVerseGap } from './verse-gap'

const john = (chapter: number, verse: number): number =>
  makeVerseId(43, chapter, verse)

const reference = (...ranges: [number, number][]): Reference => ({
  book: 43,
  ranges: ranges.map(([startId, endId]) => ({ startId, endId })),
})

describe('isVerseGap', () => {
  it('finds a gap where the reference skips verses', () => {
    expect(
      isVerseGap(
        john(15, 6),
        john(15, 9),
        reference([john(15, 4), john(15, 6)], [john(15, 9), john(15, 9)]),
      ),
    ).toBe(true)
  })

  it('finds no gap between consecutive verses', () => {
    expect(
      isVerseGap(
        john(15, 4),
        john(15, 5),
        reference([john(15, 4), john(15, 6)]),
      ),
    ).toBe(false)
  })

  it('finds no gap across a chapter boundary', () => {
    expect(
      isVerseGap(
        john(15, 27),
        john(16, 1),
        reference([john(15, 27), john(15, 27)], [john(16, 1), john(16, 1)]),
      ),
    ).toBe(false)
  })

  it('finds no gap where the missing verse is one the reference asked for', () => {
    expect(
      isVerseGap(
        john(15, 4),
        john(15, 6),
        reference([john(15, 4), john(15, 6)]),
      ),
    ).toBe(false)
  })

  it('finds a gap when only part of the missing stretch is a content gap', () => {
    expect(
      isVerseGap(
        john(15, 4),
        john(15, 9),
        reference([john(15, 4), john(15, 5)], [john(15, 9), john(15, 9)]),
      ),
    ).toBe(true)
  })

  it('finds no gap between one verse and itself', () => {
    expect(
      isVerseGap(
        john(15, 4),
        john(15, 4),
        reference([john(15, 4), john(15, 4)]),
      ),
    ).toBe(false)
  })

  describe('on a Book', () => {
    beforeEach(installHumilityBook)
    afterEach(uninstallHumilityBook)

    const paragraph = (chapter: number, atom: number): number =>
      makeVerseId(HUMILITY_BOOK, chapter, atom)

    it('finds a gap between skipped paragraphs', () => {
      expect(
        isVerseGap(paragraph(1, 2), paragraph(1, 5), {
          book: HUMILITY_BOOK,
          ranges: [
            { startId: paragraph(1, 2), endId: paragraph(1, 2) },
            { startId: paragraph(1, 5), endId: paragraph(1, 5) },
          ],
        }),
      ).toBe(true)
    })

    it('finds no gap across a section boundary', () => {
      expect(
        isVerseGap(paragraph(1, 9), paragraph(2, 1), {
          book: HUMILITY_BOOK,
          ranges: [
            { startId: paragraph(1, 9), endId: paragraph(1, 9) },
            { startId: paragraph(2, 1), endId: paragraph(2, 1) },
          ],
        }),
      ).toBe(false)
    })
  })
})
