import { EditorState } from '@codemirror/state'
import {
  EditorView,
  type DecorationSet,
  type ViewPlugin,
} from '@codemirror/view'
import { editorLivePreviewField } from 'obsidian'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setLivePreview } from '../../tests/mocks/obsidian'
import {
  createLivePreviewExtension,
  ReferenceWidget,
} from './live-preview-extension'
import {
  buildReferenceRenderModel,
  type RenderContext,
} from './reference-render-model'
import type { ReferenceRenderDeps } from './render-reference'

const deps: ReferenceRenderDeps = {
  passages: { passage: async () => ({ status: 'unavailable' }) },
  openReference: vi.fn(),
}

const widget = (
  inner: string,
  context: RenderContext,
  sourcePath: string | null = null,
): ReferenceWidget => {
  const model = buildReferenceRenderModel(inner, context)
  if (!model) throw new Error(`unparseable: ${inner}`)
  return new ReferenceWidget(`{${inner}}`, model, deps, sourcePath)
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

  it('redraws when the note path changes', () => {
    expect(
      widget('John 15:4', webDefault, 'a.md').eq(
        widget('John 15:4', webDefault, 'b.md'),
      ),
    ).toBe(false)
  })
})

describe('editor mode switching', () => {
  let view: EditorView

  afterEach(() => view.destroy())

  const editorOver = (doc: string) => {
    const extension = createLivePreviewExtension(
      () => webDefault,
      deps,
    ) as ViewPlugin<{ decorations: DecorationSet }>
    view = new EditorView({
      state: EditorState.create({
        doc,
        extensions: [editorLivePreviewField, extension],
      }),
    })
    return () => view.plugin(extension)?.decorations.size
  }

  it('removes widgets on switch to Source and restores them on return', () => {
    const decorationCount = editorOver('before {John 15:4} after')
    expect(decorationCount()).toBe(1)

    view.dispatch({ effects: setLivePreview.of(false) })
    expect(decorationCount()).toBe(0)

    view.dispatch({ effects: setLivePreview.of(true) })
    expect(decorationCount()).toBe(1)
  })
})
