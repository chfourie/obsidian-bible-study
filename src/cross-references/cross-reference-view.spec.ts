import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  HUMILITY_BOOK,
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import { makeVerseId, type Reference } from '../reference'
import type { OccurrenceSource } from '../vault-index'
import {
  crossReferenceView,
  crossReferenceViews,
  type CrossReferenceSource,
} from './cross-reference-view'

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
  summary: 'Pride and its cure',
  hasBody: true,
  members: [atom(43, 15, 5), atom(HUMILITY_BOOK, 1, 2)],
}

const group = (
  file: string,
  declared: CrossReferenceSource['crossReference'],
  ...sources: OccurrenceSource[]
): CrossReferenceSource => ({
  file,
  crossReference: declared,
  occurrences: sources.map((source) => ({ source })),
})

beforeEach(installHumilityBook)
afterEach(uninstallHumilityBook)

describe('crossReferenceView', () => {
  it('carries the note path, summary and body flag beside the members', () => {
    const view = crossReferenceView('Cross-References/Pride.md', mixed, [])

    expect(view).toEqual({
      path: 'Cross-References/Pride.md',
      summary: 'Pride and its cure',
      hasBody: true,
      members: [
        { label: 'John 15:5', reference: atom(43, 15, 5), index: 0 },
        {
          label: 'Humility ch. 1, par. 2',
          reference: atom(HUMILITY_BOOK, 1, 2),
          index: 1,
        },
      ],
      allMembers: mixed.members,
    })
  })

  it('degrades a member of an uninstalled book to its numeric label', () => {
    uninstallHumilityBook()

    const view = crossReferenceView('pride.md', mixed, [])

    expect(view.members.map((member) => member.label)).toEqual([
      'John 15:5',
      'Book 101 1:2',
    ])
  })

  it('drops the book members already on screen, as it does for scripture', () => {
    const view = crossReferenceView('pride.md', mixed, [atom(HUMILITY_BOOK, 1, 2)])

    expect(view.members.map((member) => member.label)).toEqual(['John 15:5'])
    expect(view.allMembers).toHaveLength(2)
  })
})

describe('crossReferenceViews', () => {
  it('rows every group a member of which intersects', () => {
    const views = crossReferenceViews(
      [
        group('a.md', mixed, 'cross-reference-frontmatter'),
        group('b.md', { ...mixed, summary: null }, 'body', 'cross-reference-frontmatter'),
      ],
      [],
    )

    expect(views.map((view) => [view.path, view.summary])).toEqual([
      ['a.md', 'Pride and its cure'],
      ['b.md', null],
    ])
  })

  it('leaves out annotations and mentions', () => {
    const views = crossReferenceViews(
      [group('mention.md', null, 'body'), group('anno.md', null, 'annotation-frontmatter')],
      [],
    )

    expect(views).toEqual([])
  })

  it('leaves out a cross-reference note only its body brings in', () => {
    const views = crossReferenceViews([group('body-only.md', mixed, 'body')], [])

    expect(views).toEqual([])
  })
})
