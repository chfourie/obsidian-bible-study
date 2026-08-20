import { describe, expect, it } from 'vitest'
import type { BookContent } from '../modules'
import { makeVerseId } from '../reference'
import { bookAtoms } from './search-scan'

const john15 = (): BookContent => ({
  [makeVerseId(43, 15, 3)]: 'Already you are clean.',
  [makeVerseId(43, 15, 1)]: 'I am the true vine.',
  [makeVerseId(43, 15, 2)]: {
    text: 'He takes away every branch that bears no fruit.',
  },
})

describe('bookAtoms', () => {
  it('reads a book’s atoms in verse-id order, whatever order they are stored in', () => {
    expect(bookAtoms(john15()).map((atom) => atom.verseId)).toEqual([
      makeVerseId(43, 15, 1),
      makeVerseId(43, 15, 2),
      makeVerseId(43, 15, 3),
    ])
  })

  it('reads structured verse content as its text', () => {
    expect(bookAtoms(john15())[1].text).toBe(
      'He takes away every branch that bears no fruit.',
    )
  })

  it('has no atoms for a book with no content', () => {
    expect(bookAtoms({})).toEqual([])
  })
})
