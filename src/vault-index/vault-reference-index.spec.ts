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
    index.indexNote('note.md', '{John 15:1-3} and {Luke 15:4}', null)

    expect(index.intersectingOccurrences(johnRef(15, 4))).toEqual([])
  })

  it('replaces a note occurrences when re-indexed', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('note.md', '{John 15:4}', null)
    index.indexNote('note.md', '{John 3:16}', null)

    expect(index.intersectingOccurrences(johnRef(15, 4))).toEqual([])
    expect(index.intersectingOccurrences(johnRef(3, 16))).toHaveLength(1)
  })

  it('drops a note re-indexed with no references left', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('note.md', '{John 15:4}', null)
    index.indexNote('note.md', 'plain text now', null)

    expect(index.intersectingOccurrences(johnRef(15, 4))).toEqual([])
  })

  it('evicts a removed note', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('note.md', '{John 15:4}', null)
    index.removeNote('note.md')

    expect(index.intersectingOccurrences(johnRef(15, 4))).toEqual([])
  })

  it('moves occurrences to the new path on rename', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('old.md', '{John 15:4}', null)
    index.renameNote('old.md', 'folder/new.md')

    const groups = index.intersectingOccurrences(johnRef(15, 4))
    expect(groups.map((group) => group.file)).toEqual(['folder/new.md'])
    expect(groups[0].occurrences.map((o) => o.file)).toEqual(['folder/new.md'])
  })

  it('returns an indexed occurrence intersecting the queried reference', () => {
    const index = new VaultReferenceIndex()
    index.indexNote('Sermons/Abiding.md', 'On {John 15:1-17} we see', null)

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
