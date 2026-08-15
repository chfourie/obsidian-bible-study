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
