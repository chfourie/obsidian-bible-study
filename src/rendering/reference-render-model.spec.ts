import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import { parseReference } from '../reference'
import {
  buildReferenceRenderModel,
  modelFromParsed,
  sameRenderModel,
  type ReferenceRenderModel,
} from './reference-render-model'

const context = {
  knownTranslationIds: ['web', 'nkjv'],
  defaultTranslationId: 'web',
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
    })

    expect(sameRenderModel(build('John 15:4'), other)).toBe(false)
  })

  it('differs when a token becomes a known translation', () => {
    const other = build('John 15:4 kjv', {
      knownTranslationIds: ['kjv'],
      defaultTranslationId: 'kjv',
    })

    expect(sameRenderModel(build('John 15:4 kjv'), other)).toBe(false)
  })

  it('differs across references and display modes', () => {
    expect(sameRenderModel(build('John 15:4'), build('John 15:9'))).toBe(false)
    expect(sameRenderModel(build('John 15:4'), build('John 15:4 block'))).toBe(
      false,
    )
  })
})
