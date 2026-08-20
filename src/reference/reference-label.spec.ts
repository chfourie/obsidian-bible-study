import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  HUMILITY_BOOK,
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import { referenceLabel } from './reference-label'
import { makeVerseId } from './verse-id'
import type { Reference } from './verse-range'

const humilityRef = (chapter: number, from: number, to = from): Reference => ({
  book: HUMILITY_BOOK,
  ranges: [
    {
      startId: makeVerseId(HUMILITY_BOOK, chapter, from),
      endId: makeVerseId(HUMILITY_BOOK, chapter, to),
    },
  ],
})

const john = (chapter: number, verse: number): Reference => ({
  book: 43,
  ranges: [
    {
      startId: makeVerseId(43, chapter, verse),
      endId: makeVerseId(43, chapter, verse),
    },
  ],
})

beforeEach(installHumilityBook)
afterEach(uninstallHumilityBook)

describe('referenceLabel', () => {
  it('keeps scripture in its numeric form', () => {
    expect(referenceLabel(john(3, 16))).toBe('John 3:16')
  })

  it("names a book's paragraphs in the book display format", () => {
    expect(referenceLabel(humilityRef(2, 2))).toBe('Humility ch. 2, par. 2')
    expect(referenceLabel(humilityRef(0, 1, 3))).toBe(
      'Humility Preface, pars. 1-3',
    )
  })

  it('degrades to the numeric form once the book is uninstalled', () => {
    const reference = humilityRef(2, 2)

    uninstallHumilityBook()

    expect(referenceLabel(reference)).toBe('Book 101 2:2')
  })
})
