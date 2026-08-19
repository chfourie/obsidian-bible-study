import { EditorState } from '@codemirror/state'
import {
  EditorView,
  type DecorationSet,
  type ViewPlugin,
} from '@codemirror/view'
import { editorLivePreviewField } from 'obsidian'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setLivePreview } from '../../tests/mocks/obsidian'
import { attachHighlightEditing } from './highlight-editing'
import {
  createLivePreviewExtension,
  ReferenceWidget,
  verifiedTokenStart,
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

describe('highlight editing in Live Preview', () => {
  let view: EditorView

  afterEach(() => {
    view.destroy()
    document.body.replaceChildren()
  })

  const renderingDeps: ReferenceRenderDeps = {
    passages: {
      passage: async () => ({
        status: 'ok',
        attribution: null,
        verses: [
          { verseId: 43015004, segments: [{ text: 'Remain in me', redLetter: false }] },
        ],
      }),
    },
    openReference: vi.fn(),
  }

  const editorOverAll = async (doc: string): Promise<HTMLElement[]> => {
    view = new EditorView({
      state: EditorState.create({
        doc,
        extensions: [
          editorLivePreviewField,
          createLivePreviewExtension(
            () => webDefault,
            renderingDeps,
            attachHighlightEditing,
          ),
        ],
      }),
      parent: document.body,
    })
    const expected = [...doc.matchAll(/\{/g)].length
    return await vi.waitFor(() => {
      const hosts = [
        ...view.contentDOM.querySelectorAll<HTMLElement>('[data-verse-id]'),
      ]
      if (hosts.length < expected) throw new Error('passage not rendered')
      return hosts
    })
  }

  const editorOver = async (doc: string): Promise<HTMLElement> =>
    (await editorOverAll(doc))[0]

  const paint = (verseText: HTMLElement, swatch: number): void => {
    const text = document.createTreeWalker(verseText, NodeFilter.SHOW_TEXT)
      .nextNode() as Text
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 6)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    const swatches = document.querySelectorAll(
      '.scripture-study-highlight-swatch',
    )
    swatches[swatch].dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }

  it('writes the cue and pins the effective translation on the first stroke', async () => {
    const verseText = await editorOver('before {John 15:4 inline} after')

    paint(verseText, 0)

    expect(view.state.doc.toString()).toBe(
      'before {John 15:4 web inline h1/4.0-4.6} after',
    )
  })

  it('leaves an already-explicit translation alone', async () => {
    const verseText = await editorOver('note {John 15:4 web inline}')

    paint(verseText, 1)

    expect(view.state.doc.toString()).toBe('note {John 15:4 web inline h2/4.0-4.6}')
  })

  it('erases a cue back out of the token, keeping the pin', async () => {
    const verseText = await editorOver('note {John 15:4 web inline h1/4.0-4.6}')

    paint(verseText, 5)

    expect(view.state.doc.toString()).toBe('note {John 15:4 web inline}')
  })

  it('rewrites the occurrence the stroke was made in, not its twin', async () => {
    const hosts = await editorOverAll(
      'note {John 15:4 web inline} and {John 15:4 web inline}',
    )

    paint(hosts[1], 0)

    expect(view.state.doc.toString()).toBe(
      'note {John 15:4 web inline} and {John 15:4 web inline h1/4.0-4.6}',
    )
  })
})

describe('verifiedTokenStart', () => {
  const doc = 'a {John 15:4} b {John 15:4}'

  it('takes a position that spells out the token', () => {
    expect(verifiedTokenStart(doc, 16, '{John 15:4}')).toBe(16)
  })

  it('refuses to look elsewhere for an identical token', () => {
    expect(verifiedTokenStart(doc, 15, '{John 15:4}')).toBeNull()
  })
})
