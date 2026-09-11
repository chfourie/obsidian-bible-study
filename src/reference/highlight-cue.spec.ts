import { describe, expect, it } from 'vitest'
import {
  formatExcerptPart,
  formatHighlightCue,
  formatUnderlineCue,
  isCueToken,
  parseCueToken,
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
    expect(parseCueToken(formatHighlightCue(original, reference), reference))
      .toEqual({ family: 'highlight', cue: original })
  })
})

describe('parseCueToken — cue families', () => {
  const reference = referenceOf('John 15:1-16')

  it('reads an underline token into its slot with the highlight grammar', () => {
    expect(parseCueToken('u2/5.4-5.25', reference)).toEqual({
      family: 'underline',
      cue: cue(2, john(15, 5), 4, john(15, 5), 25),
    })
  })

  it('reads an excerpt token as a slotless part', () => {
    expect(parseCueToken('x/5.4-25', reference)).toEqual({
      family: 'excerpt',
      part: {
        startVerseId: john(15, 5),
        startChar: 4,
        endVerseId: john(15, 5),
        endChar: 25,
      },
    })
  })

  it('reads a highlight token as before', () => {
    expect(parseCueToken('H1/7.0-9.12', reference)).toEqual({
      family: 'highlight',
      cue: cue(1, john(15, 7), 0, john(15, 9), 12),
    })
  })

  it('rejects an underline outside slots 1–5 and a slotted excerpt', () => {
    expect(parseCueToken('u0/5.4-25', reference)).toBeNull()
    expect(parseCueToken('u6/5.4-25', reference)).toBeNull()
    expect(parseCueToken('u/5.4-25', reference)).toBeNull()
    expect(parseCueToken('x1/5.4-25', reference)).toBeNull()
  })

  it('rejects every family addressing a verse outside the reference', () => {
    const narrow = referenceOf('John 15:4-6')
    expect(parseCueToken('h1/9.0-9.5', narrow)).toBeNull()
    expect(parseCueToken('u1/9.0-9.5', narrow)).toBeNull()
    expect(parseCueToken('x/9.0-9.5', narrow)).toBeNull()
  })

  it('formats underlines and excerpt parts with the shared endpoint text', () => {
    const wide = referenceOf('John 15:26-16:4')
    expect(
      formatUnderlineCue(cue(4, john(15, 27), 3, john(16, 1), 8), wide),
    ).toBe('u4/27.3-16:1.8')
    expect(
      formatExcerptPart(
        {
          startVerseId: john(15, 27),
          startChar: 3,
          endVerseId: john(16, 1),
          endChar: 8,
        },
        wide,
      ),
    ).toBe('x/27.3-16:1.8')
  })

  it('round-trips underlines and excerpt parts through the parser', () => {
    const wide = referenceOf('John 15:26-16:4')
    const underline = cue(5, john(15, 27), 3, john(16, 1), 8)
    const part = {
      startVerseId: john(16, 2),
      startChar: 0,
      endVerseId: john(16, 2),
      endChar: 12,
    }
    expect(parseCueToken(formatUnderlineCue(underline, wide), wide)).toEqual({
      family: 'underline',
      cue: underline,
    })
    expect(parseCueToken(formatExcerptPart(part, wide), wide)).toEqual({
      family: 'excerpt',
      part,
    })
  })
})

describe('isCueToken', () => {
  it('recognises tokens of all three families, shorthand included', () => {
    expect(isCueToken('h1/5.4-5.25')).toBe(true)
    expect(isCueToken('U2/5.4-25')).toBe(true)
    expect(isCueToken('x/5.4-25')).toBe(true)
  })

  it('recognises malformed tokens of every family by their prefix', () => {
    expect(isCueToken('h9/nonsense')).toBe(true)
    expect(isCueToken('u0/5.4-25')).toBe(true)
    expect(isCueToken('x1/5.4-25')).toBe(true)
    expect(isCueToken('u/5.4-25')).toBe(true)
  })

  it('leaves other option tokens alone', () => {
    expect(isCueToken('nkjv')).toBe(false)
    expect(isCueToken('block')).toBe(false)
    expect(isCueToken('hux')).toBe(false)
  })
})
