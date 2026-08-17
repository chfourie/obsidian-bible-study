import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import type { Passage, PassageVerse } from './module-passage-source'
import { buildReferenceRenderModel } from './reference-render-model'
import {
  buildPassageView,
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
        label: null,
        segments: [{ text: 'Remain in me.', redLetter: false }],
        startsNewLine: false,
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
