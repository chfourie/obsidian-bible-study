import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  HUMILITY_BOOK,
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import { makeVerseId, type Reference } from '../reference'
import { crossReferenceView } from './cross-reference-view'

const atom = (book: number, chapter: number, verse: number): Reference => ({
  book,
  ranges: [
    {
      startId: makeVerseId(book, chapter, verse),
      endId: makeVerseId(book, chapter, verse),
    },
  ],
})

const mixed = {
  id: 'xref-1',
  description: 'Pride and its cure',
  members: [atom(43, 15, 5), atom(HUMILITY_BOOK, 1, 2)],
}

beforeEach(installHumilityBook)
afterEach(uninstallHumilityBook)

describe('crossReferenceView', () => {
  it('labels a book member in the book display format beside scripture', () => {
    const view = crossReferenceView(mixed, [])

    expect(view.members.map((member) => member.label)).toEqual([
      'John 15:5',
      'Humility ch. 1, par. 2',
    ])
  })

  it('degrades a member of an uninstalled book to its numeric label', () => {
    uninstallHumilityBook()

    const view = crossReferenceView(mixed, [])

    expect(view.members.map((member) => member.label)).toEqual([
      'John 15:5',
      'Book 101 1:2',
    ])
  })

  it('drops the book members already on screen, as it does for scripture', () => {
    const view = crossReferenceView(mixed, [atom(HUMILITY_BOOK, 1, 2)])

    expect(view.members.map((member) => member.label)).toEqual(['John 15:5'])
    expect(view.allMembers).toHaveLength(2)
  })
})
