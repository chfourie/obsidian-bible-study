import { afterEach, describe, expect, it } from 'vitest'
import {
  HUMILITY_BOOK,
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import { makeVerseId, type Reference } from '../reference'
import { isAnnotation, VaultReferenceIndex } from './vault-reference-index'

const john = (chapter: number, verse: number) => makeVerseId(43, chapter, verse)

const johnRef = (
  startChapter: number,
  startVerse: number,
  endChapter = startChapter,
  endVerse = startVerse,
): Reference => ({
  book: 43,
  ranges: [
    { startId: john(startChapter, startVerse), endId: john(endChapter, endVerse) },
  ],
})

describe('VaultReferenceIndex', () => {
  it('excludes occurrences sharing no verse with the query', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('note.md', '{John 15:1-3} and {Luke 15:4}')

    expect(index.intersectingOccurrences(johnRef(15, 4))).toEqual([])
  })

  it('replaces a note occurrences when re-indexed', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('note.md', '{John 15:4}')
    index.indexNote('note.md', '{John 3:16}')

    expect(index.intersectingOccurrences(johnRef(15, 4))).toEqual([])
    expect(index.intersectingOccurrences(johnRef(3, 16))).toHaveLength(1)
  })

  it('drops a note re-indexed with no references left', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('note.md', '{John 15:4}')
    index.indexNote('note.md', 'plain text now')

    expect(index.intersectingOccurrences(johnRef(15, 4))).toEqual([])
  })

  it('evicts a removed note', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('note.md', '{John 15:4}')
    index.removeNote('note.md')

    expect(index.intersectingOccurrences(johnRef(15, 4))).toEqual([])
  })

  it('moves occurrences to the new path on rename', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('old.md', '{John 15:4}')
    index.renameNote('old.md', 'folder/new.md')

    const groups = index.intersectingOccurrences(johnRef(15, 4))
    expect(groups.map((group) => group.file)).toEqual(['folder/new.md'])
    expect(groups[0].occurrences.map((o) => o.file)).toEqual(['folder/new.md'])
  })

  it('flags a group as annotation when its frontmatter ref intersects', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('Annotations/John 15.4.md', '---\nref: John 15:4\n---\nnotes')

    expect(index.intersectingOccurrences(johnRef(15, 4))).toEqual([
      {
        file: 'Annotations/John 15.4.md',
        annotationReference: johnRef(15, 4),
        occurrences: [
          {
            file: 'Annotations/John 15.4.md',
            position: 0,
            reference: johnRef(15, 4),
            source: 'annotation-frontmatter',
          },
        ],
      },
    ])
  })

  it('classifies an annotation note by its file even when only its body intersects', () => {
    const index = new VaultReferenceIndex()
    index.indexNote(
      'Annotations/John 15.4.md',
      '---\nref: John 15:4\n---\ncompare {Luke 15:4}',
    )

    const groups = index.intersectingOccurrences({
      book: 42,
      ranges: [{ startId: makeVerseId(42, 15, 4), endId: makeVerseId(42, 15, 4) }],
    })
    expect(groups.map(isAnnotation)).toEqual([true])
    expect(groups.map((group) => group.annotationReference)).toEqual([
      johnRef(15, 4),
    ])
  })

  it('orders groups annotations first, then file path A-Z', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('b-mention.md', '{John 15:4}')
    index.indexNote('a-mention.md', '{John 15:1-17}')
    index.indexNote('z-annotation.md', '---\nref: John 15:4\n---\n')

    expect(
      index.intersectingOccurrences(johnRef(15, 4)).map((group) => group.file),
    ).toEqual(['z-annotation.md', 'a-mention.md', 'b-mention.md'])
  })

  it('orders occurrences within a group by position', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('note.md', '{John 15:9} then {John 15:4}')

    const groups = index.intersectingOccurrences(johnRef(15, 1, 15, 17))
    expect(groups[0].occurrences.map((o) => o.position)).toEqual([0, 17])
  })

  it('returns an indexed occurrence intersecting the queried reference', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('Sermons/Abiding.md', 'On {John 15:1-17} we see')

    expect(index.intersectingOccurrences(johnRef(15, 4))).toEqual([
      {
        file: 'Sermons/Abiding.md',
        annotationReference: null,
        occurrences: [
          {
            file: 'Sermons/Abiding.md',
            position: 3,
            reference: johnRef(15, 1, 15, 17),
            source: 'body',
          },
        ],
      },
    ])
  })
})

describe('VaultReferenceIndex change events', () => {
  it('notifies subscribers when a note is indexed, removed, or renamed', () => {
    const index = new VaultReferenceIndex()
    let notified = 0
    index.onChanged(() => notified++)

    index.indexNote('note.md', '{John 15:4}')
    index.renameNote('note.md', 'moved.md')
    index.removeNote('moved.md')

    expect(notified).toBe(3)
  })

  it('stops notifying after unsubscribe', () => {
    const index = new VaultReferenceIndex()
    let notified = 0
    const unsubscribe = index.onChanged(() => notified++)

    unsubscribe()
    index.indexNote('note.md', '{John 15:4}')

    expect(notified).toBe(0)
  })

  it('skips notifying when re-indexing leaves the occurrences unchanged', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('note.md', 'see {John 15:4} and {John 15:9}')
    let notified = 0
    index.onChanged(() => notified++)

    index.indexNote('note.md', 'see {John 15:4} and {John 15:9}')

    expect(notified).toBe(0)
  })

  it('notifies when an annotation note is re-indexed with unchanged occurrences (body-only edit)', () => {
    const index = new VaultReferenceIndex()
    index.indexNote(
      'Annotations/John 15.4.md',
      '---\nref: John 15:4\n---\noriginal thoughts',
    )
    let notified = 0
    index.onChanged(() => notified++)

    index.indexNote(
      'Annotations/John 15.4.md',
      '---\nref: John 15:4\n---\nrevised thoughts',
    )

    expect(notified).toBe(1)
  })

  it('notifies when a re-index changes the occurrences', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('note.md', '{John 15:4}')
    let notified = 0
    index.onChanged(() => notified++)

    index.indexNote('note.md', '{John 15:9}')

    expect(notified).toBe(1)
  })

  it('skips notifying when indexing a note without occurrences', () => {
    const index = new VaultReferenceIndex()
    let notified = 0
    index.onChanged(() => notified++)

    index.indexNote('plain.md', 'no references here')

    expect(notified).toBe(0)
  })

  it('skips notifying when removing a note that was never indexed', () => {
    const index = new VaultReferenceIndex()
    let notified = 0
    index.onChanged(() => notified++)

    index.removeNote('unknown.md')

    expect(notified).toBe(0)
  })
})

// A book's references live in the index only while its module is installed;
// uninstalling makes them dormant, never deleting anything (spec-books §6).
describe('VaultReferenceIndex dormancy of an uninstalled book', () => {
  const NOTE = 'Sermons/Lowly.md'
  const CONTENT = 'On {John 15:5} and {Humility 1:2}.'

  const humilityParagraph: Reference = {
    book: HUMILITY_BOOK,
    ranges: [
      {
        startId: makeVerseId(HUMILITY_BOOK, 1, 2),
        endId: makeVerseId(HUMILITY_BOOK, 1, 2),
      },
    ],
  }

  afterEach(uninstallHumilityBook)

  it('drops and restores the occurrences with the module, note untouched', () => {
    installHumilityBook()
    const index = new VaultReferenceIndex()
    index.indexNote(NOTE, CONTENT)
    expect(index.intersectingOccurrences(humilityParagraph)).toHaveLength(1)

    uninstallHumilityBook()
    index.indexNote(NOTE, CONTENT)

    expect(index.intersectingOccurrences(humilityParagraph)).toEqual([])
    expect(index.intersectingOccurrences(johnRef(15, 5))).toHaveLength(1)

    installHumilityBook()
    index.indexNote(NOTE, CONTENT)

    expect(index.intersectingOccurrences(humilityParagraph)).toHaveLength(1)
    expect(CONTENT).toBe('On {John 15:5} and {Humility 1:2}.')
  })
})
