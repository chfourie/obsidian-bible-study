import { describe, expect, it } from 'vitest'
import {
  buildReferenceRenderModel,
  sameRenderModel,
  type ReferenceRenderModel,
} from './reference-render-model'

const context = {
  knownTranslationIds: ['web', 'nkjv'],
  defaultTranslationId: 'web',
}

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
      buildReferenceRenderModel('John 15:4 nkjv callout', context)?.display,
    ).toBe('callout')
  })

  it('carries the flow keyword', () => {
    expect(buildReferenceRenderModel('John 15:4 callout', context)?.flow).toBe(
      false,
    )
    expect(
      buildReferenceRenderModel('John 15:4 callout flow', context)?.flow,
    ).toBe(true)
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
    expect(
      sameRenderModel(build('John 15:4'), build('John 15:4 callout')),
    ).toBe(false)
  })

  it('differs when flow changes', () => {
    expect(
      sameRenderModel(
        build('John 15:4 callout'),
        build('John 15:4 callout flow'),
      ),
    ).toBe(false)
  })
})
