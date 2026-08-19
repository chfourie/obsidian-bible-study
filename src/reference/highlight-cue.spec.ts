import { describe, expect, it } from 'vitest'
import {
  formatHighlightCue,
  isHighlightCueToken,
  parseHighlightCue,
  type HighlightCue,
  type HighlightSlot,
} from './highlight-cue'
import { parseReference } from './parse-reference'
import { makeVerseId } from './verse-id'

const john = (chapter: number, verse: number) => makeVerseId(43, chapter, verse)

const referenceOf = (text: string) => {
  const parsed = parseReference(text)
  if (!parsed) throw new Error(`unparsed reference: ${text}`)
  return parsed.reference
}

const cue = (
  slot: HighlightSlot,
  startVerseId: number,
  startChar: number,
  endVerseId: number,
  endChar: number,
): HighlightCue => ({ slot, startVerseId, startChar, endVerseId, endChar })

describe('formatHighlightCue', () => {
  it('writes both endpoints without a chapter inside the reference chapter', () => {
    expect(
      formatHighlightCue(
        cue(1, john(15, 5), 4, john(15, 5), 25),
        referenceOf('John 15:1-16'),
      ),
    ).toBe('h1/5.4-5.25')
  })

  it('spans verses with the end verse spelled out', () => {
    expect(
      formatHighlightCue(
        cue(2, john(15, 7), 0, john(15, 9), 12),
        referenceOf('John 15:1-16'),
      ),
    ).toBe('h2/7.0-9.12')
  })

  it('qualifies endpoints outside the inherited chapter', () => {
    expect(
      formatHighlightCue(
        cue(3, john(16, 2), 10, john(16, 2), 20),
        referenceOf('John 15:26-16:4'),
      ),
    ).toBe('h3/16:2.10-16:2.20')
  })

  it('qualifies only the endpoint that leaves the inherited chapter', () => {
    expect(
      formatHighlightCue(
        cue(4, john(15, 27), 3, john(16, 1), 8),
        referenceOf('John 15:26-16:4'),
      ),
    ).toBe('h4/27.3-16:1.8')
  })

  it('round-trips through the parser', () => {
    const reference = referenceOf('John 15:26-16:4')
    const original = cue(5, john(15, 27), 3, john(16, 1), 8)
    expect(parseHighlightCue(formatHighlightCue(original, reference), reference))
      .toEqual(original)
  })
})

describe('isHighlightCueToken', () => {
  it('recognises canonical and shorthand cue tokens', () => {
    expect(isHighlightCueToken('h1/5.4-5.25')).toBe(true)
    expect(isHighlightCueToken('H2/5.4-25')).toBe(true)
  })

  it('recognises a malformed cue token by its prefix', () => {
    expect(isHighlightCueToken('h1/nonsense')).toBe(true)
  })

  it('leaves other option tokens alone', () => {
    expect(isHighlightCueToken('nkjv')).toBe(false)
    expect(isHighlightCueToken('block')).toBe(false)
  })
})
