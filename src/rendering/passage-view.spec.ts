import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ENOCH_BOOK,
  ENOCH_CHAPTER_5,
  ENOCH_MODULE_ID,
  enochPassageStore,
  installEnochBook,
  uninstallEnochBook,
} from '../../tests/fixtures/enoch-book'
import {
  HUMILITY_BOOK,
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import { makeVerseId } from '../reference'
import {
  ModulePassageSource,
  type Passage,
  type PassageVerse,
} from './module-passage-source'
import { buildReferenceRenderModel } from './reference-render-model'
import {
  buildPassageView,
  isPoetryVerse,
  loadingText,
  unavailableText,
  verseBlocks,
} from './passage-view'

const context = {
  knownTranslationIds: ['web', 'nkjv'],
  defaultTranslationId: 'web',
  pageBreaks: true,
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

    expect(verseBlocks(view)).toEqual([
      {
        verseId: makeVerseId(43, 15, 4),
        label: null,
        letterLabel: null,
        segments: [{ text: 'Remain in me.', redLetter: false }],
        startsNewLine: false,
        startsParagraph: false,
        textOffset: 0,
        table: null,
      },
    ])
  })

  it('numbers inline verses when the reference spans several', () => {
    const view = buildPassageView(
      model('John 15:4-5 inline'),
      passage([verse(15, 4, 'Remain.'), verse(15, 5, 'I am the vine.')]),
    )

    expect(verseBlocks(view).map((block) => block.label)).toEqual(['4', '5'])
  })

  it('numbers block verses even for a single verse', () => {
    const view = buildPassageView(
      model('John 15:4 block'),
      passage([verse(15, 4, 'Remain in me.')]),
    )

    expect(verseBlocks(view).map((block) => block.label)).toEqual(['4'])
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

    expect(verseBlocks(view).map((block) => block.label)).toEqual([
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

    expect(verseBlocks(view)[0].segments).toEqual([
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

    expect(verseBlocks(view).map((block) => block.startsNewLine)).toEqual([
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

    expect(verseBlocks(view)[0].startsNewLine).toBe(true)
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
      pageBreaks: true,
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

    expect(verseBlocks(view)[0].segments).toEqual([
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

    expect(verseBlocks(view)[0].segments).toEqual([
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

    expect(verseBlocks(view)[0].segments).toEqual([
      { text: 'Rem', redLetter: false },
      { text: 'ain ', redLetter: false, highlightSlot: 3 },
      { text: 'in ', redLetter: false, supplied: true, highlightSlot: 3 },
      { text: 'me.', redLetter: false, supplied: true },
    ])
  })

  it('counts a mark glyph and a supplied word as characters of the highlighted string', () => {
    // 1 Enoch 1:4's stretch `even on Mount Sinai, [And appear` — a highlight
    // from the supplied word across the interpolation bracket keeps every
    // offset the stored string has (spec-books §10).
    const view = buildPassageView(
      model('John 15:4 inline h1/4.22-54'),
      passage([
        {
          verseId: makeVerseId(43, 15, 4),
          segments: [
            { text: 'tread upon the earth, ', redLetter: false },
            { text: 'even', redLetter: false, supplied: true },
            { text: ' on Mount Sinai, ', redLetter: false },
            { text: '[', redLetter: false, marks: true },
            { text: 'And appear from His camp', redLetter: false },
            { text: ']', redLetter: false, marks: true },
          ],
        },
      ]),
    )

    expect(verseBlocks(view)[0].segments).toEqual([
      { text: 'tread upon the earth, ', redLetter: false },
      { text: 'even', redLetter: false, supplied: true, highlightSlot: 1 },
      { text: ' on Mount Sinai, ', redLetter: false, highlightSlot: 1 },
      { text: '[', redLetter: false, marks: true, highlightSlot: 1 },
      { text: 'And appear', redLetter: false, highlightSlot: 1 },
      { text: ' from His camp', redLetter: false },
      { text: ']', redLetter: false, marks: true },
    ])
  })

  it('highlights a noted atom by the offsets of its stored string alone', () => {
    // The atom's notes were lifted out at build (spec-books §6), so a
    // highlight over `been steadfast.` runs where the print's own reading
    // puts it — the note body is nowhere in the view.
    const view = buildPassageView(
      model('John 15:4 inline h1/4.16-31'),
      passage([
        {
          verseId: makeVerseId(43, 15, 4),
          segments: [{ text: 'But ye have not been steadfast.', redLetter: false }],
          footnotes: ['So Dillmann; the Ethiopic is corrupt here.'],
        },
      ]),
    )

    expect(verseBlocks(view)[0].segments).toEqual([
      { text: 'But ye have not ', redLetter: false },
      { text: 'been steadfast.', redLetter: false, highlightSlot: 1 },
    ])
    expect(JSON.stringify(view)).not.toContain('Dillmann')
  })

  it('clamps offsets past the end of the stored verse text', () => {
    const view = buildPassageView(
      model('John 15:4 inline h1/4.7-400'),
      passage([verse(15, 4, 'Remain in me.')]),
    )

    expect(verseBlocks(view)[0].segments).toEqual([
      { text: 'Remain ', redLetter: false },
      { text: 'in me.', redLetter: false, highlightSlot: 1 },
    ])
  })

  it('paints only the verses the reference contains across a gap', () => {
    const view = buildPassageView(
      model('John 15:4,9 block h1/4.7-9.6'),
      passage([verse(15, 4, 'Remain in me.'), verse(15, 9, 'Remain in my love.')]),
    )

    expect(verseBlocks(view).map((block) => block.segments)).toEqual([
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

    expect(verseBlocks(view)[0].segments).toEqual([
      { text: 'Remain in me.', redLetter: false },
    ])
  })

  it('suppresses highlights on a fallback-served passage', () => {
    const view = buildPassageView(model('John 15:4 nkjv inline h1/4.0-6'), {
      ...passage([verse(15, 4, 'Remain in me.')]),
      fallback: { requested: 'nkjv', served: 'web' },
    })

    expect(verseBlocks(view)[0].segments).toEqual([
      { text: 'Remain in me.', redLetter: false },
    ])
  })

  it('leaves segments untouched when the reference carries no cues', () => {
    const segments = [{ text: 'Remain in me.', redLetter: false }]
    const view = buildPassageView(
      model('John 15:4 inline'),
      passage([{ verseId: makeVerseId(43, 15, 4), segments }]),
    )

    expect(verseBlocks(view)[0].segments).toBe(segments)
  })
})

describe('buildPassageView — verse gaps', () => {
  const kinds = (view: ReturnType<typeof buildPassageView>) =>
    view.entries.map((entry) =>
      entry.kind === 'verse' ? entry.verse.label : entry.kind,
    )

  it('stands an ellipsis where the reference skips verses', () => {
    const view = buildPassageView(
      model('John 15:4-6,9 inline'),
      passage([
        verse(15, 4, 'Remain in me.'),
        verse(15, 5, 'I am the vine.'),
        verse(15, 6, 'He is thrown away.'),
        verse(15, 9, 'Remain in my love.'),
      ]),
    )

    expect(kinds(view)).toEqual(['4', '5', '6', 'ellipsis', '9'])
    expect(view.entries[3]).toEqual({ kind: 'ellipsis', reason: 'gap' })
  })

  it('stands no ellipsis between verses adjacent across a chapter boundary', () => {
    const view = buildPassageView(
      model('John 15:27,16:1 inline'),
      passage([
        verse(15, 27, 'You will also testify.'),
        verse(16, 1, 'I have told you these things.'),
      ]),
    )

    expect(kinds(view)).toEqual(['15:27', '16:1'])
  })

  it('stands no ellipsis where the translation does not serve a verse the reference asks for', () => {
    const view = buildPassageView(
      model('John 15:4-6 inline'),
      passage([verse(15, 4, 'Remain in me.'), verse(15, 6, 'He is thrown away.')]),
    )

    expect(kinds(view)).toEqual(['4', '6'])
  })

  it('stands an ellipsis for each separate skip', () => {
    const view = buildPassageView(
      model('John 15:4,6,9 block'),
      passage([
        verse(15, 4, 'Remain in me.'),
        verse(15, 6, 'He is thrown away.'),
        verse(15, 9, 'Remain in my love.'),
      ]),
    )

    expect(kinds(view)).toEqual(['4', 'ellipsis', '6', 'ellipsis', '9'])
  })
})

describe('buildPassageView — verse gaps in a Book', () => {
  beforeEach(installHumilityBook)
  afterEach(uninstallHumilityBook)

  it('stands an ellipsis between skipped paragraphs', () => {
    const paragraph = (atom: number, text: string): PassageVerse => ({
      verseId: makeVerseId(HUMILITY_BOOK, 1, atom),
      segments: [{ text, redLetter: false }],
    })
    const view = buildPassageView(
      model('Humility 1:2,1:5 block'),
      passage([paragraph(2, 'The second.'), paragraph(5, 'The fifth.')]),
    )

    expect(view.entries.map((entry) => entry.kind)).toEqual([
      'verse',
      'ellipsis',
      'verse',
    ])
  })
})

describe('buildPassageView — a verse-atom Book’s page walk', () => {
  const walked = async (text: string) => {
    const rendered = model(text)
    const passage = await new ModulePassageSource(enochPassageStore()).passage(
      rendered.reference,
      ENOCH_MODULE_ID,
    )
    if (passage.status !== 'ok') throw new Error(`unavailable: ${text}`)
    return buildPassageView(rendered, passage)
  }
  const seven = makeVerseId(ENOCH_BOOK, 5, 7)

  beforeEach(installEnochBook)
  afterEach(uninstallEnochBook)

  it('numbers a block at every entry into a different atom and letters every lettered line', async () => {
    const view = await walked('1 Enoch 5:6-7 block')

    expect(verseBlocks(view).map((block) => block.label)).toEqual([
      '6', null, null, '7', '6', null, null, null, null, null, '7', null,
    ])
    expect(verseBlocks(view).map((block) => block.letterLabel)).toEqual([
      '6a', '6b', '6c', '7c', '6d', '6e', '6f', '6g', '6i', '6j', '7a', '7b',
    ])
  })

  it('walks inline the same way with the letters omitted', async () => {
    const view = await walked('1 Enoch 5:6-7 inline')

    expect(verseBlocks(view).map((block) => block.label)).toEqual([
      '6', null, null, '7', '6', null, null, null, null, null, '7', null,
    ])
    expect(verseBlocks(view).every((block) => block.letterLabel === null)).toBe(true)
  })

  it('gives each step its own line’s text, with the break the step boundary owns dropped', async () => {
    const view = await walked('1 Enoch 5:6-7 block')
    const lines = ENOCH_CHAPTER_5[7].lines ?? []

    const sevenC = verseBlocks(view)[3]
    expect(sevenC.segments.map((segment) => segment.text).join('')).toBe(
      'And for you, the godless, there shall be a curse.',
    )
    expect(sevenC.segments[0].lineBreakBefore).toBeUndefined()
    expect(sevenC.startsNewLine).toBe(true)
    expect(sevenC.textOffset).toBe(lines[2].start)
  })

  it('paints a highlight over 5:7 on every step of 7 and on no step of 6', async () => {
    const view = await walked('1 Enoch 5:6-7 block h1/7.0-140')

    const painted = verseBlocks(view).map((block) =>
      block.segments.some((segment) => segment.highlightSlot === 1),
    )
    expect(verseBlocks(view).map((block) => block.verseId === seven)).toEqual(painted)
  })

  it('opens a new run at a stanza blank inside an atom, never at an atom’s first line', async () => {
    const view = await walked('1 Enoch 5:9 block')

    expect(verseBlocks(view).map((block) => block.startsParagraph)).toEqual([
      false, false, true, false,
    ])
  })

  it('numbers a single-atom inline walk not at all', async () => {
    const view = await walked('1 Enoch 5:7 inline')

    expect(verseBlocks(view).map((block) => block.label)).toEqual([null, null, null])
  })

  it('a single-atom note reads 7a 7b 7c — the traditional verse, not the page', async () => {
    const view = await walked('1 Enoch 5:7 block')

    expect(verseBlocks(view).map((block) => block.letterLabel)).toEqual(['7a', '7b', '7c'])
    expect(verseBlocks(view).map((block) => block.label)).toEqual(['7', null, null])
  })
})
