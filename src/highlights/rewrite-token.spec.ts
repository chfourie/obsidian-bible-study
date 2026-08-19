import { describe, expect, it } from 'vitest'
import {
  makeVerseId,
  type HighlightCue,
  type HighlightSlot,
} from '../reference'
import { rewriteHighlightToken } from './rewrite-token'

const john = (chapter: number, verse: number) => makeVerseId(43, chapter, verse)

const cue = (
  slot: HighlightSlot,
  startVerse: number,
  startChar: number,
  endVerse: number,
  endChar: number,
  chapter = 15,
): HighlightCue => ({
  slot,
  startVerseId: john(chapter, startVerse),
  startChar,
  endVerseId: john(chapter, endVerse),
  endChar,
})

const options = { translation: 'nkjv', translationIds: ['nkjv', 'kjv'] }

const rewrite = (text: string, cues: readonly HighlightCue[]) =>
  rewriteHighlightToken(text, cues, options)

describe('rewriteHighlightToken — pinning', () => {
  it('pins the effective translation on the first highlight', () => {
    expect(rewrite('John 15:1-16', [cue(1, 5, 4, 5, 25)])).toBe(
      'John 15:1-16 nkjv h1/5.4-5.25',
    )
  })

  it('leaves an explicit translation alone', () => {
    expect(rewrite('John 15:1-16 kjv', [cue(1, 5, 4, 5, 25)])).toBe(
      'John 15:1-16 kjv h1/5.4-5.25',
    )
  })

  it('keeps the pinned translation when the last cue is erased', () => {
    expect(rewrite('John 15:1-16 nkjv h1/5.4-5.25', [])).toBe(
      'John 15:1-16 nkjv',
    )
  })

  it('pins nothing when there is no highlight to protect', () => {
    expect(rewrite('John 15:1-16 h1/5.4-5.25', [])).toBe('John 15:1-16')
  })

  it('pins nothing when no effective translation is known', () => {
    expect(
      rewriteHighlightToken('John 15:1-16', [cue(1, 5, 4, 5, 25)], {
        translationIds: ['nkjv', 'kjv'],
      }),
    ).toBe('John 15:1-16 h1/5.4-5.25')
  })
})

describe('rewriteHighlightToken — minimal diff', () => {
  it('preserves the spelling and spacing of the reference', () => {
    expect(rewrite('JOHN  15:1-16   block', [cue(1, 5, 4, 5, 25)])).toBe(
      'JOHN  15:1-16 nkjv   block h1/5.4-5.25',
    )
  })

  it('preserves the order of existing option tokens', () => {
    expect(rewrite('John 15:1-16 block kjv', [cue(1, 5, 4, 5, 25)])).toBe(
      'John 15:1-16 block kjv h1/5.4-5.25',
    )
  })

  it('replaces an existing cue tail', () => {
    expect(
      rewrite('John 15:1-16 nkjv h1/5.4-5.25', [cue(2, 7, 0, 9, 12)]),
    ).toBe('John 15:1-16 nkjv h2/7.0-9.12')
  })

  it('lifts cue tokens out from among the user tokens', () => {
    expect(
      rewrite('John 15:1-16 h1/5.4-25 block kjv', [cue(2, 7, 0, 9, 12)]),
    ).toBe('John 15:1-16 block kjv h2/7.0-9.12')
  })

  it('sweeps away a malformed cue token', () => {
    expect(rewrite('John 15:1-16 kjv h9/nonsense', [cue(1, 5, 4, 5, 25)])).toBe(
      'John 15:1-16 kjv h1/5.4-5.25',
    )
  })

  it('preserves trailing space when there is no cue tail to append', () => {
    expect(rewrite('John 15:1-16 ', [])).toBe('John 15:1-16 ')
  })

  it('leaves an unparseable reference untouched', () => {
    expect(rewrite('Nowhere 5:1', [cue(1, 5, 4, 5, 25)])).toBe('Nowhere 5:1')
  })
})

describe('rewriteHighlightToken — canonical cue tail', () => {
  it('sorts the tail by verse and start offset', () => {
    expect(
      rewrite('John 15:1-16 nkjv', [cue(2, 9, 20, 9, 25), cue(1, 5, 4, 5, 9)]),
    ).toBe('John 15:1-16 nkjv h1/5.4-5.9 h2/9.20-9.25')
  })

  it('qualifies cues outside the inherited chapter', () => {
    expect(
      rewriteHighlightToken(
        'John 15:26-16:4 nkjv',
        [cue(3, 2, 10, 2, 20, 16)],
        options,
      ),
    ).toBe('John 15:26-16:4 nkjv h3/16:2.10-16:2.20')
  })
})
