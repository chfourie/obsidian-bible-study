import { afterEach, describe, expect, it } from 'vitest'
import {
  HUMILITY_BOOK,
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import { makeVerseId, type Reference } from '../reference'
import { crossReferenceNote } from '../../tests/fixtures/cross-reference-note'
import {
  isAnnotation,
  isCrossReference,
  isMention,
  VaultReferenceIndex,
} from './vault-reference-index'

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
        crossReference: null,
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

  it('points a relative occurrence at the chip a jump should land on', () => {
    const content = 'On {John 15:4-9}: {:5} above all.'
    const index = new VaultReferenceIndex()
    index.indexNote('Sermons/Abiding.md', content)

    const groups = index.intersectingOccurrences(johnRef(15, 5))
    expect(groups[0].occurrences).toEqual([
      {
        file: 'Sermons/Abiding.md',
        position: content.indexOf('{John 15:4-9}'),
        reference: johnRef(15, 4, 15, 9),
        source: 'body',
      },
      {
        file: 'Sermons/Abiding.md',
        position: content.indexOf('{:5}'),
        reference: johnRef(15, 5),
        source: 'body',
      },
    ])
  })

  it('returns an indexed occurrence intersecting the queried reference', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('Sermons/Abiding.md', 'On {John 15:1-17} we see')

    expect(index.intersectingOccurrences(johnRef(15, 4))).toEqual([
      {
        file: 'Sermons/Abiding.md',
        annotationReference: null,
        crossReference: null,
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

describe('VaultReferenceIndex cross-reference notes', () => {
  const vine = crossReferenceNote({
    members: ['John 15:1-8', 'Psalm 80:8-16'],
    summary: 'Vine imagery',
  })
  const psalmRef = (start: number, end: number): Reference => ({
    book: 19,
    ranges: [{ startId: makeVerseId(19, 80, start), endId: makeVerseId(19, 80, end) }],
  })

  it('groups an intersecting member with every member, the summary and the body flag', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('Cross-References/Vine.md', vine)

    expect(index.intersectingOccurrences(johnRef(15, 4))).toEqual([
      {
        file: 'Cross-References/Vine.md',
        annotationReference: null,
        crossReference: {
          members: [johnRef(15, 1, 15, 8), psalmRef(8, 16)],
          summary: 'Vine imagery',
          hasBody: false,
        },
        occurrences: [
          {
            file: 'Cross-References/Vine.md',
            position: 0,
            reference: johnRef(15, 1, 15, 8),
            source: 'cross-reference-frontmatter',
          },
        ],
      },
    ])
  })

  it('classifies a cross-reference, never a mention, even when only its body intersects', () => {
    const index = new VaultReferenceIndex()
    index.indexNote(
      'Cross-References/Vine.md',
      crossReferenceNote({ members: ['John 15:1-8'], body: 'compare {Luke 15:4}' }),
    )

    const groups = index.intersectingOccurrences({
      book: 42,
      ranges: [{ startId: makeVerseId(42, 15, 4), endId: makeVerseId(42, 15, 4) }],
    })
    expect(groups.map(isCrossReference)).toEqual([true])
    expect(groups.map(isMention)).toEqual([false])
    expect(groups.map(isAnnotation)).toEqual([false])
  })

  it('is both annotation and cross-reference when it carries ref and refs', () => {
    const index = new VaultReferenceIndex()
    index.indexNote(
      'both.md',
      crossReferenceNote({ members: ['Psalm 80:8-16'], ref: 'John 15:4' }),
    )

    const groups = index.intersectingOccurrences(johnRef(15, 4))
    expect(groups.map(isAnnotation)).toEqual([true])
    expect(groups.map(isCrossReference)).toEqual([true])
    expect(groups[0].crossReference?.members).toEqual([psalmRef(8, 16)])
  })

  it('is a mention with neither frontmatter declaration', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('note.md', 'see {John 15:4}')

    const groups = index.intersectingOccurrences(johnRef(15, 4))
    expect(groups.map(isMention)).toEqual([true])
    expect(groups[0].crossReference).toBe(null)
  })

  it('keeps only the parseable members', () => {
    const index = new VaultReferenceIndex()
    index.indexNote(
      'one.md',
      crossReferenceNote({ members: ['John 15:1-8', 'Jhon 15:4'] }),
    )

    expect(
      index.intersectingOccurrences(johnRef(15, 4))[0].crossReference?.members,
    ).toEqual([johnRef(15, 1, 15, 8)])
  })

  it('reflects a changed summary and body on re-index', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('vine.md', vine)
    let notified = 0
    index.onChanged(() => notified++)

    index.indexNote(
      'vine.md',
      crossReferenceNote({
        members: ['John 15:1-8', 'Psalm 80:8-16'],
        summary: 'Israel as vine',
        body: 'Notes.',
      }),
    )

    expect(notified).toBe(1)
    expect(index.intersectingOccurrences(johnRef(15, 4))[0].crossReference).toEqual({
      members: [johnRef(15, 1, 15, 8), psalmRef(8, 16)],
      summary: 'Israel as vine',
      hasBody: true,
    })
  })

  it('reflects a corrected summary on a note whose members were all unparseable', () => {
    const index = new VaultReferenceIndex()
    const lukeRef = (): Reference => ({
      book: 42,
      ranges: [{ startId: makeVerseId(42, 15, 4), endId: makeVerseId(42, 15, 4) }],
    })
    const typo = (summary: string): string =>
      crossReferenceNote({ members: ['Jhon 15:4'], summary, body: 'compare {Luke 15:4}' })
    index.indexNote('vine.md', typo('Vine'))
    let notified = 0
    index.onChanged(() => notified++)

    // Same length, so the body occurrence sits where it did: only the
    // declaration changed.
    index.indexNote('vine.md', typo('Wine'))

    expect(notified).toBe(1)
    expect(index.intersectingOccurrences(lukeRef())[0].crossReference).toEqual({
      members: [],
      summary: 'Wine',
      hasBody: true,
    })
  })

  it('follows a rename with its declaration', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('vine.md', vine)

    index.renameNote('vine.md', 'Cross-References/Vine.md')

    const groups = index.intersectingOccurrences(johnRef(15, 4))
    expect(groups.map((group) => group.file)).toEqual(['Cross-References/Vine.md'])
    expect(groups[0].crossReference?.summary).toBe('Vine imagery')
  })

  it('evicts a deleted cross-reference note', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('vine.md', vine)

    index.removeNote('vine.md')

    expect(index.intersectingOccurrences(johnRef(15, 4))).toEqual([])
  })

  it('leaves a plain mention with no cross-reference declaration', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('Annotations/John 15.4.md', '---\nref: John 15:4\n---\nnotes')

    expect(index.intersectingOccurrences(johnRef(15, 4))[0].crossReference).toBe(
      null,
    )
  })
})
