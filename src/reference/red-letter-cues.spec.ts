import { describe, expect, it } from 'vitest'
import {
  decodeRedLetterCues,
  encodeRedLetterCues,
  redLetterCueOf,
} from './red-letter-cues'
import { makeVerseId } from './verse-id'

describe('red-letter cue codec', () => {
  it('round-trips a sorted set of cue entries', () => {
    const entries = [
      { verseId: makeVerseId(40, 5, 4), code: 'F' as const },
      { verseId: makeVerseId(40, 4, 7), code: 'E' as const },
      { verseId: makeVerseId(44, 9, 4), code: 'E' as const },
      { verseId: makeVerseId(40, 5, 5), code: 'S' as const },
      { verseId: makeVerseId(43, 3, 16), code: 'B' as const },
      { verseId: makeVerseId(42, 24, 7), code: 'M' as const },
    ]
    const decoded = decodeRedLetterCues(encodeRedLetterCues(entries))
    expect(decoded.size).toBe(entries.length)
    expect(decoded.get(makeVerseId(40, 5, 4))).toEqual({ kind: 'full' })
    expect(decoded.get(makeVerseId(40, 4, 7))).toEqual({
      kind: 'partial',
      redAtStart: false,
      redAtEnd: true,
    })
    expect(decoded.get(makeVerseId(40, 5, 5))).toEqual({
      kind: 'partial',
      redAtStart: true,
      redAtEnd: false,
    })
    expect(decoded.get(makeVerseId(43, 3, 16))).toEqual({
      kind: 'partial',
      redAtStart: true,
      redAtEnd: true,
    })
    expect(decoded.get(makeVerseId(42, 24, 7))).toEqual({
      kind: 'partial',
      redAtStart: false,
      redAtEnd: false,
    })
  })

  it('encodes an empty entry list to an empty string', () => {
    expect(encodeRedLetterCues([])).toBe('')
    expect(decodeRedLetterCues('').size).toBe(0)
  })
})

describe('redLetterCueOf against the shipped BSB-derived table', () => {
  it('marks Matthew 5:4 as fully red', () => {
    expect(redLetterCueOf(makeVerseId(40, 5, 4))).toEqual({ kind: 'full' })
  })

  it('marks Matthew 4:7 as partial with red reaching the verse end', () => {
    expect(redLetterCueOf(makeVerseId(40, 4, 7))).toEqual({
      kind: 'partial',
      redAtStart: false,
      redAtEnd: true,
    })
  })

  it('reports none for a verse without words of Christ', () => {
    expect(redLetterCueOf(makeVerseId(40, 1, 1))).toEqual({ kind: 'none' })
    expect(redLetterCueOf(makeVerseId(1, 1, 1))).toEqual({ kind: 'none' })
  })

  it('marks Acts 9:4 (outside the Gospels) as partial with red at the end', () => {
    expect(redLetterCueOf(makeVerseId(44, 9, 4))).toEqual({
      kind: 'partial',
      redAtStart: false,
      redAtEnd: true,
    })
  })

  it('treats Luke 24:7 as full despite the closing quote after the red span', () => {
    expect(redLetterCueOf(makeVerseId(42, 24, 7))).toEqual({ kind: 'full' })
  })
})
