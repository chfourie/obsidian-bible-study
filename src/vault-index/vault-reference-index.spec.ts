import { describe, expect, it } from 'vitest'
import { makeVerseId, type Reference } from '../reference'
import { VaultReferenceIndex } from './vault-reference-index'

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
        annotation: true,
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

  it('keeps a body-only mention inside an annotation note out of the annotation class', () => {
    const index = new VaultReferenceIndex()
    index.indexNote(
      'Annotations/John 15.4.md',
      '---\nref: John 15:4\n---\ncompare {Luke 15:4}',
    )

    const groups = index.intersectingOccurrences({
      book: 42,
      ranges: [{ startId: makeVerseId(42, 15, 4), endId: makeVerseId(42, 15, 4) }],
    })
    expect(groups.map((group) => group.annotation)).toEqual([false])
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
        annotation: false,
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
