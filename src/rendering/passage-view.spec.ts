import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import type { Passage, PassageVerse } from './module-passage-source'
import { buildReferenceRenderModel } from './reference-render-model'
import {
  buildPassageView,
  isPoetryVerse,
  loadingText,
  unavailableText,
} from './passage-view'

const context = {
  knownTranslationIds: ['web', 'nkjv'],
  defaultTranslationId: 'web',
}

const model = (text: string) => {
  const built = buildReferenceRenderModel(text, context)
  if (!built) throw new Error(`unparseable: ${text}`)
  return built
}

const verse = (
  chapter: number,
  verseNumber: number,
  text: string,
): PassageVerse => ({
  verseId: makeVerseId(43, chapter, verseNumber),
  segments: [{ text, redLetter: false }],
})

const passage = (
  verses: PassageVerse[],
  attribution: string | null = null,
): Extract<Passage, { status: 'ok' }> => ({
  status: 'ok',
  verses,
  attribution,
})

describe('buildPassageView', () => {
  it('renders a single inline verse without a verse number', () => {
    const view = buildPassageView(
      model('John 15:4 inline'),
      passage([verse(15, 4, 'Remain in me.')]),
    )

    expect(view.verses).toEqual([
      {
        verseId: makeVerseId(43, 15, 4),
        label: null,
        segments: [{ text: 'Remain in me.', redLetter: false }],
        startsNewLine: false,
        table: null,
      },
    ])
  })

  it('numbers inline verses when the reference spans several', () => {
    const view = buildPassageView(
      model('John 15:4-5 inline'),
      passage([verse(15, 4, 'Remain.'), verse(15, 5, 'I am the vine.')]),
    )

    expect(view.verses.map((block) => block.label)).toEqual(['4', '5'])
  })

  it('numbers block verses even for a single verse', () => {
    const view = buildPassageView(
      model('John 15:4 block'),
      passage([verse(15, 4, 'Remain in me.')]),
    )

    expect(view.verses.map((block) => block.label)).toEqual(['4'])
  })

  it('labels chapter starts with chapter and verse in multi-chapter passages', () => {
    const view = buildPassageView(
      model('John 15:26-16:2 block'),
      passage([
        verse(15, 26, 'The Counselor will testify.'),
        verse(15, 27, 'You will also testify.'),
        verse(16, 1, 'I have told you these things.'),
        verse(16, 2, 'They will put you out.'),
      ]),
    )

    expect(view.verses.map((block) => block.label)).toEqual([
      '15:26',
      '27',
      '16:1',
      '2',
    ])
  })

  it('shows attribution only in block mode', () => {
    const attributed = passage([verse(15, 4, 'Remain.')], 'Copyright © 1982')

    expect(
      buildPassageView(model('John 15:4 block'), attributed).attribution,
    ).toBe('Copyright © 1982')
    expect(
      buildPassageView(model('John 15:4 inline'), attributed).attribution,
    ).toBeNull()
  })

  it('names the translation actually served when a fallback substituted', () => {
    const substituted = {
      ...passage([verse(15, 4, 'Remain in me.')]),
      fallback: { requested: 'nkjv', served: 'web' },
    }

    expect(
      buildPassageView(model('John 15:4 nkjv inline'), substituted)
        .fallbackNotice,
    ).toBe('WEB (NKJV unavailable)')
  })

  it('carries no fallback notice when the requested translation was served', () => {
    expect(
      buildPassageView(
        model('John 15:4 inline'),
        passage([verse(15, 4, 'Remain in me.')]),
      ).fallbackNotice,
    ).toBeNull()
  })

  it('keeps red-letter segments intact', () => {
    const view = buildPassageView(
      model('John 15:4 inline'),
      passage([
        {
          verseId: makeVerseId(43, 15, 4),
          segments: [
            { text: 'Remain in me, and I in you.', redLetter: true },
          ],
        },
      ]),
    )

    expect(view.verses[0].segments).toEqual([
      { text: 'Remain in me, and I in you.', redLetter: true },
    ])
  })

  it('marks verses carrying line data to start on their own line', () => {
    const view = buildPassageView(
      model('John 15:4-5 inline'),
      passage([
        verse(15, 4, 'Plain prose.'),
        { ...verse(15, 5, 'Poetic line.'), hasLineData: true },
      ]),
    )

    expect(view.verses.map((block) => block.startsNewLine)).toEqual([
      false,
      true,
    ])
  })

  it('marks every Psalms verse to start on its own line', () => {
    const psalmVerse: PassageVerse = {
      verseId: makeVerseId(19, 23, 1),
      segments: [{ text: 'The LORD is my shepherd.', redLetter: false }],
    }

    const view = buildPassageView(
      model('Psalms 23:1 inline'),
      passage([psalmVerse]),
    )

    expect(view.verses[0].startsNewLine).toBe(true)
  })
})

describe('isPoetryVerse', () => {
  const plainSegments = [{ text: 'Plain prose.', redLetter: false }]

  it('classifies a verse with an indented line as poetry', () => {
    expect(
      isPoetryVerse(
        [
          { text: 'First line, ', redLetter: false, lineStart: true, indent: 1 },
          {
            text: 'second line.',
            redLetter: false,
            lineStart: true,
            lineBreakBefore: true,
            indent: 2,
          },
        ],
        43,
      ),
    ).toBe(true)
  })

  it('classifies a verse with a psalm heading line as poetry', () => {
    expect(
      isPoetryVerse(
        [
          {
            text: 'A Psalm of David.',
            redLetter: false,
            lineStart: true,
            psalmHeading: true,
          },
        ],
        43,
      ),
    ).toBe(true)
  })

  it('classifies every Psalms verse as poetry', () => {
    expect(isPoetryVerse(plainSegments, 19)).toBe(true)
  })

  it('does not classify flat line breaks without indent as poetry', () => {
    expect(
      isPoetryVerse(
        [
          { text: 'First line, ', redLetter: false, lineStart: true },
          {
            text: 'second line.',
            redLetter: false,
            lineStart: true,
            lineBreakBefore: true,
          },
        ],
        43,
      ),
    ).toBe(false)
  })

  it('does not classify plain prose as poetry', () => {
    expect(isPoetryVerse(plainSegments, 43)).toBe(false)
  })
})

describe('async state text', () => {
  it('describes loading with the normalized reference', () => {
    expect(loadingText(model('John 15:4 inline'))).toBe('Loading John 15:4…')
  })

  it('describes an unavailable passage with its translation', () => {
    expect(unavailableText(model('John 15:4 nkjv inline'))).toBe(
      'John 15:4 (NKJV) unavailable offline',
    )
    expect(unavailableText(model('John 15:4 inline'))).toBe(
      'John 15:4 (WEB) unavailable offline',
    )
  })

  it('describes an unresolvable translation as not installed', () => {
    const bare = buildReferenceRenderModel('John 15:4', {
      knownTranslationIds: [],
      defaultTranslationId: null,
    })
    if (!bare) throw new Error('unparseable')

    expect(unavailableText(bare)).toBe(
      'John 15:4 unavailable — no translation installed',
    )
  })
})

describe('buildPassageView — highlights', () => {
  it('splits a verse segment at the highlight boundaries', () => {
    const view = buildPassageView(
      model('John 15:4 inline h1/4.0-6'),
      passage([verse(15, 4, 'Remain in me.')]),
    )

    expect(view.verses[0].segments).toEqual([
      { text: 'Remain', redLetter: false, highlightSlot: 1 },
      { text: ' in me.', redLetter: false },
    ])
  })

  it('tints red-letter text without dropping its red-letter flag', () => {
    const view = buildPassageView(
      model('John 15:4 block h2/4.0-6'),
      passage([
        {
          verseId: makeVerseId(43, 15, 4),
          segments: [{ text: 'Remain in me.', redLetter: true }],
        },
      ]),
    )

    expect(view.verses[0].segments).toEqual([
      { text: 'Remain', redLetter: true, highlightSlot: 2 },
      { text: ' in me.', redLetter: true },
    ])
  })

  it('carries a highlight across neighbouring segments', () => {
    const view = buildPassageView(
      model('John 15:4 inline h3/4.3-10'),
      passage([
        {
          verseId: makeVerseId(43, 15, 4),
          segments: [
            { text: 'Remain ', redLetter: false },
            { text: 'in me.', redLetter: false, supplied: true },
          ],
        },
      ]),
    )

    expect(view.verses[0].segments).toEqual([
      { text: 'Rem', redLetter: false },
      { text: 'ain ', redLetter: false, highlightSlot: 3 },
      { text: 'in ', redLetter: false, supplied: true, highlightSlot: 3 },
      { text: 'me.', redLetter: false, supplied: true },
    ])
  })

  it('clamps offsets past the end of the stored verse text', () => {
    const view = buildPassageView(
      model('John 15:4 inline h1/4.7-400'),
      passage([verse(15, 4, 'Remain in me.')]),
    )

    expect(view.verses[0].segments).toEqual([
      { text: 'Remain ', redLetter: false },
      { text: 'in me.', redLetter: false, highlightSlot: 1 },
    ])
  })

  it('paints only the verses the reference contains across a gap', () => {
    const view = buildPassageView(
      model('John 15:4,9 block h1/4.7-9.6'),
      passage([verse(15, 4, 'Remain in me.'), verse(15, 9, 'Remain in my love.')]),
    )

    expect(view.verses.map((block) => block.segments)).toEqual([
      [
        { text: 'Remain ', redLetter: false },
        { text: 'in me.', redLetter: false, highlightSlot: 1 },
      ],
      [
        { text: 'Remain', redLetter: false, highlightSlot: 1 },
        { text: ' in my love.', redLetter: false },
      ],
    ])
  })

  it('paints nothing where the translation has a content gap', () => {
    const view = buildPassageView(
      model('John 15:4-5 block h1/5.0-5.6'),
      passage([verse(15, 4, 'Remain in me.')]),
    )

    expect(view.verses[0].segments).toEqual([
      { text: 'Remain in me.', redLetter: false },
    ])
  })

  it('suppresses highlights on a fallback-served passage', () => {
    const view = buildPassageView(model('John 15:4 nkjv inline h1/4.0-6'), {
      ...passage([verse(15, 4, 'Remain in me.')]),
      fallback: { requested: 'nkjv', served: 'web' },
    })

    expect(view.verses[0].segments).toEqual([
      { text: 'Remain in me.', redLetter: false },
    ])
  })

  it('leaves segments untouched when the reference carries no cues', () => {
    const segments = [{ text: 'Remain in me.', redLetter: false }]
    const view = buildPassageView(
      model('John 15:4 inline'),
      passage([{ verseId: makeVerseId(43, 15, 4), segments }]),
    )

    expect(view.verses[0].segments).toBe(segments)
  })
})
