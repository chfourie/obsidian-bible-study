import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import { makeVerseId, parseReference } from '../reference'
import {
  buildReferenceRenderModel,
  modelFromParsed,
  sameRenderModel,
  type ReferenceRenderModel,
} from './reference-render-model'

const context = {
  knownTranslationIds: ['web', 'nkjv'],
  defaultTranslationId: 'web',
  pageBreaks: true,
}

describe('modelFromParsed', () => {
  it('marks a full reference as not relative', () => {
    const parsed = parseReference('John 15:5')

    expect(modelFromParsed(parsed!, context).relativeSpec).toBeNull()
  })

  it('carries the typed relative spec beside the resolved reference', () => {
    const parsed = parseReference('John 15:5 nkjv', {
      translationIds: context.knownTranslationIds,
    })

    const model = modelFromParsed(parsed!, context, ':5')

    expect(model).toMatchObject({
      relativeSpec: ':5',
      referenceText: 'John 15:5',
      translationId: 'nkjv',
      chipLabel: 'NKJV',
      display: 'chip',
    })
  })
})

describe('buildReferenceRenderModel — cue families', () => {
  const john = (chapter: number, verse: number) => makeVerseId(43, chapter, verse)

  it('carries the underline cues and excerpt parts beside the highlights', () => {
    const model = buildReferenceRenderModel(
      'John 15:1-16 inline h1/5.4-25 u2/7.0-7.9 x/9.0-9.8',
      context,
    )

    expect(model?.highlights).toEqual([
      {
        slot: 1,
        startVerseId: john(15, 5),
        startChar: 4,
        endVerseId: john(15, 5),
        endChar: 25,
      },
    ])
    expect(model?.underlines).toEqual([
      {
        slot: 2,
        startVerseId: john(15, 7),
        startChar: 0,
        endVerseId: john(15, 7),
        endChar: 9,
      },
    ])
    expect(model?.excerpt).toEqual([
      {
        startVerseId: john(15, 9),
        startChar: 0,
        endVerseId: john(15, 9),
        endChar: 8,
      },
    ])
  })
})

describe('buildReferenceRenderModel', () => {
  it('returns null for an invalid reference', () => {
    expect(buildReferenceRenderModel('"json": true', context)).toBeNull()
    expect(buildReferenceRenderModel('Nowhere 3:16', context)).toBeNull()
  })

  it('builds a chip model with normalized reference text', () => {
    const model = buildReferenceRenderModel('jhn 15:9,4-6', context)

    expect(model).toMatchObject({
      display: 'chip',
      referenceText: 'John 15:4-6,9',
      translationId: 'web',
      chipLabel: null,
      invalidTokens: [],
    })
  })

  it('labels the chip only for an explicitly specified translation', () => {
    const model = buildReferenceRenderModel('John 15:4 nkjv', context)

    expect(model?.translationId).toBe('nkjv')
    expect(model?.chipLabel).toBe('NKJV')
  })

  it('labels the chip even when the explicit translation is the default', () => {
    const model = buildReferenceRenderModel('John 15:4 web', context)

    expect(model?.chipLabel).toBe('WEB')
  })

  it('honors display keywords', () => {
    expect(buildReferenceRenderModel('John 15:4 inline', context)?.display).toBe(
      'inline',
    )
    expect(
      buildReferenceRenderModel('John 15:4 nkjv block', context)?.display,
    ).toBe('block')
  })

  it('collects invalid tokens while rendering the reference normally', () => {
    const model = buildReferenceRenderModel('John 15:4 bogus inline xyz', context)

    expect(model?.display).toBe('inline')
    expect(model?.invalidTokens).toEqual(['bogus', 'xyz'])
  })

  it('leaves translation unresolved when no default is configured', () => {
    const model = buildReferenceRenderModel('John 15:4', {
      knownTranslationIds: [],
      defaultTranslationId: null,
      pageBreaks: true,
    })

    expect(model?.translationId).toBeNull()
    expect(model?.chipLabel).toBeNull()
  })

  it('keeps the parsed reference for navigation', () => {
    const model = buildReferenceRenderModel('John 15:4', context)

    expect(model?.reference.book).toBe(43)
  })

  it('leaves scripture without a book citation', () => {
    expect(buildReferenceRenderModel('John 15:4', context)?.book).toBeNull()
  })
})

describe('buildReferenceRenderModel — book references', () => {
  beforeEach(installHumilityBook)
  afterEach(uninstallHumilityBook)

  it('displays MLA locators and carries the full citation', () => {
    const model = buildReferenceRenderModel('Humility 2:2 block', context)

    expect(model).toMatchObject({
      referenceText: 'Humility ch. 2, par. 2',
      display: 'block',
      book: {
        title: 'Humility',
        locator: 'ch. 2, par. 2',
        attribution: 'Andrew Murray, Humility (1895), ch. 2, par. 2',
      },
    })
  })

  it('pins the translation slot to the book module, not the default', () => {
    const model = buildReferenceRenderModel('Humility 2:2', context)

    expect(model?.translationId).toBe('hum-m1895')
    expect(model?.chipLabel).toBeNull()
  })

  it('ignores a translation token while keeping it flagged', () => {
    const model = buildReferenceRenderModel('Humility 2:2 nkjv', context)

    expect(model?.translationId).toBe('hum-m1895')
    expect(model?.invalidTokens).toEqual(['nkjv'])
  })

  it('renders as plain text once the module is uninstalled', () => {
    uninstallHumilityBook()

    expect(buildReferenceRenderModel('Humility 2:2', context)).toBeNull()
  })
})

describe('sameRenderModel', () => {
  const build = (
    text: string,
    modelContext = context,
  ): ReferenceRenderModel => {
    const model = buildReferenceRenderModel(text, modelContext)
    if (!model) throw new Error(`unparseable: ${text}`)
    return model
  }

  it('matches models built from the same text and context', () => {
    expect(
      sameRenderModel(build('John 15:4 inline'), build('John 15:4 inline')),
    ).toBe(true)
  })

  it('differs when the typed relative spec differs', () => {
    const parsed = parseReference('John 15:5')!

    expect(
      sameRenderModel(
        modelFromParsed(parsed, context, ':5'),
        modelFromParsed(parsed, context, '15:5'),
      ),
    ).toBe(false)
  })

  it('differs when the resolved translation differs', () => {
    const other = build('John 15:4', {
      knownTranslationIds: ['web', 'nkjv'],
      defaultTranslationId: 'nkjv',
      pageBreaks: true,
    })

    expect(sameRenderModel(build('John 15:4'), other)).toBe(false)
  })

  it('differs when a token becomes a known translation', () => {
    const other = build('John 15:4 kjv', {
      knownTranslationIds: ['kjv'],
      defaultTranslationId: 'kjv',
      pageBreaks: true,
    })

    expect(sameRenderModel(build('John 15:4 kjv'), other)).toBe(false)
  })

  it('differs when a highlight, underline or excerpt part changes', () => {
    expect(
      sameRenderModel(build('John 15:4 h1/4.0-4.5'), build('John 15:4 h1/4.0-4.5')),
    ).toBe(true)
    expect(
      sameRenderModel(build('John 15:4 h1/4.0-4.5'), build('John 15:4 h2/4.0-4.5')),
    ).toBe(false)
    expect(
      sameRenderModel(build('John 15:4 u1/4.0-4.5'), build('John 15:4 u1/4.0-4.5')),
    ).toBe(true)
    expect(
      sameRenderModel(build('John 15:4 u1/4.0-4.5'), build('John 15:4 u1/4.0-4.6')),
    ).toBe(false)
    expect(
      sameRenderModel(build('John 15:4 x/4.0-4.5'), build('John 15:4 x/4.0-4.5')),
    ).toBe(true)
    expect(
      sameRenderModel(build('John 15:4 x/4.0-4.5'), build('John 15:4')),
    ).toBe(false)
    expect(
      sameRenderModel(build('John 15:4 h1/4.0-4.5'), build('John 15:4 u1/4.0-4.5')),
    ).toBe(false)
  })

  it('differs across references and display modes', () => {
    expect(sameRenderModel(build('John 15:4'), build('John 15:9'))).toBe(false)
    expect(sameRenderModel(build('John 15:4'), build('John 15:4 block'))).toBe(
      false,
    )
  })
})
