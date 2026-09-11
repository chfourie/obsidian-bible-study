import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  makeVerseId,
  parseReference,
  type ExcerptPart,
  type HighlightCue,
  type HighlightSlot,
} from '../reference'
import {
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import {
  rewriteCueTokens,
  type CueLists,
  type CueTokenRewriteOptions,
} from './rewrite-token'

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

const part = (
  startVerse: number,
  startChar: number,
  endVerse: number,
  endChar: number,
  chapter = 15,
): ExcerptPart => ({
  startVerseId: john(chapter, startVerse),
  startChar,
  endVerseId: john(chapter, endVerse),
  endChar,
})

const options = { translation: 'nkjv', translationIds: ['nkjv', 'kjv'] }

const highlightsOnly = (cues: readonly HighlightCue[]): CueLists => ({
  highlights: cues,
  underlines: [],
  excerpt: [],
})

const rewriteHighlightToken = (
  text: string,
  cues: readonly HighlightCue[],
  rewriteOptions: CueTokenRewriteOptions = options,
) => rewriteCueTokens(text, highlightsOnly(cues), rewriteOptions)

const rewrite = (text: string, cues: readonly HighlightCue[]) =>
  rewriteHighlightToken(text, cues)

const rewriteAll = (text: string, cues: Partial<CueLists>) =>
  rewriteCueTokens(
    text,
    { highlights: [], underlines: [], excerpt: [], ...cues },
    options,
  )

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

describe('rewriteCueTokens — cue families', () => {
  it('appends the tails in the order highlights, underlines, excerpt', () => {
    expect(
      rewriteAll('John 15:1-16 nkjv', {
        excerpt: [part(9, 0, 9, 8)],
        underlines: [cue(2, 7, 0, 7, 9)],
        highlights: [cue(1, 5, 4, 5, 25)],
      }),
    ).toBe('John 15:1-16 nkjv h1/5.4-5.25 u2/7.0-7.9 x/9.0-9.8')
  })

  it('sorts each family by verse, start offset and slot', () => {
    expect(
      rewriteAll('John 15:1-16 nkjv', {
        underlines: [cue(3, 9, 20, 9, 25), cue(2, 5, 4, 5, 9), cue(1, 5, 4, 5, 9)],
        excerpt: [part(9, 0, 9, 8), part(5, 0, 5, 3)],
      }),
    ).toBe(
      'John 15:1-16 nkjv u1/5.4-5.9 u2/5.4-5.9 u3/9.20-9.25 x/5.0-5.3 x/9.0-9.8',
    )
  })

  it('lifts hand-typed underline and excerpt tokens out from among the user tokens', () => {
    expect(
      rewriteAll('John 15:1-16 x/9.0-8 block u1/5.4-25 kjv', {
        underlines: [cue(1, 5, 4, 5, 25)],
        excerpt: [part(9, 0, 9, 8)],
      }),
    ).toBe('John 15:1-16 block kjv u1/5.4-5.25 x/9.0-9.8')
  })

  it('sweeps away malformed underline and excerpt tokens', () => {
    expect(
      rewriteAll('John 15:1-16 kjv u0/5.4-25 x1/5.4-25 u/nonsense', {
        highlights: [cue(1, 5, 4, 5, 25)],
      }),
    ).toBe('John 15:1-16 kjv h1/5.4-5.25')
  })

  it('rewrites the untouched families canonically beside a highlight edit', () => {
    const parsed = parseReference('John 15:1-16 kjv u1/5.4-25 x/9.0-8', {
      translationIds: options.translationIds,
    })!

    expect(
      rewriteAll('John 15:1-16 kjv u1/5.4-25 x/9.0-8', {
        highlights: [cue(2, 7, 0, 7, 9)],
        underlines: parsed.underlines,
        excerpt: parsed.excerpt,
      }),
    ).toBe('John 15:1-16 kjv h2/7.0-7.9 u1/5.4-5.25 x/9.0-9.8')
  })

  it('pins the effective translation on the first underline', () => {
    expect(
      rewriteAll('John 15:1-16', { underlines: [cue(1, 5, 4, 5, 25)] }),
    ).toBe('John 15:1-16 nkjv u1/5.4-5.25')
  })

  it('pins the effective translation on the first excerpt part', () => {
    expect(rewriteAll('John 15:1-16', { excerpt: [part(5, 4, 5, 25)] })).toBe(
      'John 15:1-16 nkjv x/5.4-5.25',
    )
  })

  it('keeps the pinned translation when only an underline remains', () => {
    expect(
      rewriteAll('John 15:1-16 nkjv h1/5.4-5.25 u1/5.4-5.25', {
        underlines: [cue(1, 5, 4, 5, 25)],
      }),
    ).toBe('John 15:1-16 nkjv u1/5.4-5.25')
  })

  it('pins nothing when every family is empty', () => {
    expect(rewriteAll('John 15:1-16 u1/5.4-25 x/5.4-25', {})).toBe(
      'John 15:1-16',
    )
  })

  it('qualifies underline and excerpt endpoints outside the inherited chapter', () => {
    expect(
      rewriteAll('John 15:26-16:4 nkjv', {
        underlines: [cue(3, 2, 10, 2, 20, 16)],
        excerpt: [part(2, 0, 2, 5, 16)],
      }),
    ).toBe('John 15:26-16:4 nkjv u3/16:2.10-16:2.20 x/16:2.0-16:2.5')
  })

  it('round-trips all three families through parseReference', () => {
    const lists: CueLists = {
      highlights: [cue(1, 5, 4, 5, 25)],
      underlines: [cue(2, 7, 0, 7, 9)],
      excerpt: [part(9, 0, 9, 8)],
    }

    const parsed = parseReference(rewriteAll('John 15:1-16', lists), {
      translationIds: options.translationIds,
    })

    expect(parsed?.highlights).toEqual(lists.highlights)
    expect(parsed?.underlines).toEqual(lists.underlines)
    expect(parsed?.excerpt).toEqual(lists.excerpt)
    expect(parsed?.invalidTokens).toEqual([])
  })
})

describe('rewriteHighlightToken — non-biblical books', () => {
  beforeEach(installHumilityBook)
  afterEach(uninstallHumilityBook)

  const humilityVerseId = (chapter: number, paragraph: number) =>
    makeVerseId(101, chapter, paragraph)

  const humilityCue = (
    startParagraph: number,
    startChar: number,
    endParagraph: number,
    endChar: number,
  ): HighlightCue => ({
    slot: 1,
    startVerseId: humilityVerseId(1, startParagraph),
    startChar,
    endVerseId: humilityVerseId(1, endParagraph),
    endChar,
  })

  it('adds a cue without pinning a translation token', () => {
    const rewritten = rewriteHighlightToken(
      'Humility 1:2',
      [humilityCue(2, 0, 2, 10)],
      options,
    )

    expect(rewritten).toBe('Humility 1:2 h1/2.0-2.10')
    expect(rewritten).not.toContain('nkjv')
  })

  it('round-trips the rewritten token through parseReference', () => {
    const rewritten = rewriteHighlightToken(
      'Humility 1:2',
      [humilityCue(2, 0, 2, 10)],
      options,
    )

    const parsed = parseReference(rewritten, {
      translationIds: options.translationIds,
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.translation).toBeNull()
  })

  it('erasing the last cue leaves no stray translation token', () => {
    expect(
      rewriteHighlightToken('Humility 1:2 h1/1:2.0-1:2.10', [], options),
    ).toBe('Humility 1:2')
  })
})
