import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import { extractOccurrences } from './extract-occurrences'

const john = (chapter: number, verse: number) => makeVerseId(43, chapter, verse)

describe('extractOccurrences', () => {
  it('finds a body reference with its position and normalized ranges', () => {
    expect(extractOccurrences('Abide: {John 15:4} in him.', null)).toEqual([
      {
        position: 7,
        reference: { book: 43, ranges: [{ startId: john(15, 4), endId: john(15, 4) }] },
        source: 'body',
      },
    ])
  })
})
