import { describe, expect, it, vi } from 'vitest'
import { ReferenceWidget } from './live-preview-extension'
import {
  buildReferenceRenderModel,
  type RenderContext,
} from './reference-render-model'
import type { ReferenceRenderDeps } from './render-reference'

const deps: ReferenceRenderDeps = {
  passages: { passage: async () => ({ status: 'unavailable' }) },
  openReference: vi.fn(),
}

const widget = (inner: string, context: RenderContext): ReferenceWidget => {
  const model = buildReferenceRenderModel(inner, context)
  if (!model) throw new Error(`unparseable: ${inner}`)
  return new ReferenceWidget(`{${inner}}`, model, deps)
}

const webDefault: RenderContext = {
  knownTranslationIds: ['web'],
  defaultTranslationId: 'web',
}

describe('ReferenceWidget equality', () => {
  it('treats widgets over the same source and context as equal', () => {
    expect(
      widget('John 15:4 inline', webDefault).eq(
        widget('John 15:4 inline', webDefault),
      ),
    ).toBe(true)
  })

  it('redraws when the default translation changes', () => {
    const kjvDefault: RenderContext = {
      knownTranslationIds: ['web', 'kjv'],
      defaultTranslationId: 'kjv',
    }

    expect(
      widget('John 15:4', webDefault).eq(widget('John 15:4', kjvDefault)),
    ).toBe(false)
  })

  it('redraws when an installed module makes a token a translation', () => {
    const withKjv: RenderContext = {
      knownTranslationIds: ['web', 'kjv'],
      defaultTranslationId: 'web',
    }

    expect(
      widget('John 15:4 kjv', webDefault).eq(widget('John 15:4 kjv', withKjv)),
    ).toBe(false)
  })

  it('redraws when the source changes', () => {
    expect(
      widget('John 15:4', webDefault).eq(widget('John 15:9', webDefault)),
    ).toBe(false)
  })
})
