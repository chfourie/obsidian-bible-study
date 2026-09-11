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
  pageBreaks: true,
}

let view: EditorView
let plugin: ViewPlugin<{ decorations: DecorationSet }>

afterEach(() => {
  view?.destroy()
  document.body.replaceChildren()
})

const editorOver = (
  doc: string,
  context: RenderContext = webDefault,
): HTMLElement => {
  plugin = createLivePreviewExtension(() => context, deps) as ViewPlugin<{
    decorations: DecorationSet
  }>
  view = new EditorView({
    state: EditorState.create({
      doc,
      extensions: [editorLivePreviewField, plugin],
    }),
    parent: document.body,
  })
  return view.contentDOM
}

const decorationCount = (): number | undefined =>
  view.plugin(plugin)?.decorations.size

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
      pageBreaks: true,
    }

    expect(
      widget('John 15:4', webDefault).eq(widget('John 15:4', kjvDefault)),
    ).toBe(false)
  })

  it('redraws when an installed module makes a token a translation', () => {
    const withKjv: RenderContext = {
      knownTranslationIds: ['web', 'kjv'],
      defaultTranslationId: 'web',
      pageBreaks: true,
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
  it('removes widgets on switch to Source and restores them on return', () => {
    editorOver('before {John 15:4} after')
    expect(decorationCount()).toBe(1)

    view.dispatch({ effects: setLivePreview.of(false) })
    expect(decorationCount()).toBe(0)

    view.dispatch({ effects: setLivePreview.of(true) })
    expect(decorationCount()).toBe(1)
  })
})

describe('Christ Quote in Live Preview', () => {
  const redLetter = (content: HTMLElement): string[] =>
    [...content.querySelectorAll('.scripture-study-red-letter')].map(
      (span) => span.textContent ?? '',
    )

  it('hides the c and paints the quote, marks included, red', () => {
    const content = editorOver('He said c"Abide in me" then')

    expect(content.textContent).toBe('He said "Abide in me" then')
    expect(redLetter(content)).toEqual(['"Abide in me"'])
  })

  it('shows the c again, still red, while the cursor is in the quote', () => {
    const content = editorOver('He said c"Abide in me" then')

    view.dispatch({ selection: { anchor: 12 } })

    expect(content.textContent).toBe('He said c"Abide in me" then')
    expect(redLetter(content)).toEqual(['"Abide in me"'])

    view.dispatch({ selection: { anchor: 2 } })

    expect(content.textContent).toBe('He said "Abide in me" then')
  })

  it('shows raw text in Source mode and decorates again on return', () => {
    const content = editorOver('He said c"Abide in me" then')

    view.dispatch({ effects: setLivePreview.of(false) })

    expect(content.textContent).toBe('He said c"Abide in me" then')
    expect(redLetter(content)).toEqual([])

    view.dispatch({ effects: setLivePreview.of(true) })

    expect(content.textContent).toBe('He said "Abide in me" then')
    expect(redLetter(content)).toEqual(['"Abide in me"'])
  })

  it('paints a quote holding a reference chip and keeps the chip', () => {
    const content = editorOver('c"Abide {John 15:4} in me"')

    expect(redLetter(content)).toHaveLength(1)
    expect(
      content.querySelector('.scripture-study-red-letter .scripture-study-reference'),
    ).not.toBeNull()
  })
})

describe('Page Break in Live Preview', () => {
  const indicators = (content: HTMLElement): HTMLElement[] => [
    ...content.querySelectorAll<HTMLElement>('.scripture-study-page-break'),
  ]

  const trailing = (indicator: HTMLElement): boolean =>
    indicator.classList.contains('scripture-study-page-break-trailing')

  it('replaces the marker line with the reading-view indicator', () => {
    const content = editorOver('one\n\n===\n\ntwo')

    const [indicator] = indicators(content)
    expect(indicators(content)).toHaveLength(1)
    expect(trailing(indicator)).toBe(false)
    expect(
      indicator
        .querySelector('.scripture-study-page-break-icon')
        ?.getAttribute('data-icon'),
    ).toBe('separator-horizontal')
    expect(
      indicator.querySelector('.scripture-study-page-break-label')?.textContent,
    ).toBe('page break')
    expect(content.textContent).toBe('onepage breaktwo')
  })

  it('shows the indicator for a trailing break too, carrying the trailing class', () => {
    const content = editorOver('one\n\n===\n')

    const [indicator] = indicators(content)
    expect(trailing(indicator)).toBe(true)
  })

  it('shows the raw marker while the cursor is on its line and the indicator once it leaves', () => {
    const content = editorOver('one\n\n===\n\ntwo')

    view.dispatch({ selection: { anchor: 6 } })

    expect(indicators(content)).toHaveLength(0)
    expect(content.textContent).toBe('one===two')

    view.dispatch({ selection: { anchor: 0 } })

    expect(indicators(content)).toHaveLength(1)
  })

  it('shows raw text in Source mode and the indicator again on return', () => {
    const content = editorOver('one\n\n===\n\ntwo')

    view.dispatch({ effects: setLivePreview.of(false) })

    expect(indicators(content)).toHaveLength(0)
    expect(content.textContent).toBe('one===two')

    view.dispatch({ effects: setLivePreview.of(true) })

    expect(indicators(content)).toHaveLength(1)
  })

  it('leaves the marker as text with page breaks off', () => {
    const content = editorOver('one\n\n===\n\ntwo', {
      ...webDefault,
      pageBreaks: false,
    })

    expect(indicators(content)).toHaveLength(0)
    expect(content.textContent).toBe('one===two')
  })
})

describe('highlight editing in Live Preview', () => {
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

  const verseTextsOver = async (doc: string): Promise<HTMLElement[]> => {
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

  const verseTextOver = async (doc: string): Promise<HTMLElement> =>
    (await verseTextsOver(doc))[0]

  const UNDERLINE_1 = 5
  const ERASER = 10
  const SHOW_ONLY = 11

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
    const verseText = await verseTextOver('before {John 15:4 inline} after')

    paint(verseText, 0)

    expect(view.state.doc.toString()).toBe(
      'before {John 15:4 web inline h1/4.0-4.6} after',
    )
  })

  it('leaves an already-explicit translation alone', async () => {
    const verseText = await verseTextOver('note {John 15:4 web inline}')

    paint(verseText, 1)

    expect(view.state.doc.toString()).toBe('note {John 15:4 web inline h2/4.0-4.6}')
  })

  it('erases a cue back out of the token, keeping the pin', async () => {
    const verseText = await verseTextOver('note {John 15:4 web inline h1/4.0-4.6}')

    paint(verseText, ERASER)

    expect(view.state.doc.toString()).toBe('note {John 15:4 web inline}')
  })

  it('keeps hand-typed underline and excerpt tokens beside a highlight edit', async () => {
    const verseText = await verseTextOver(
      'note {John 15:4 web inline x/4.0-20 u1/4.7-4.9}',
    )

    paint(verseText, 0)

    expect(view.state.doc.toString()).toBe(
      'note {John 15:4 web inline h1/4.0-4.6 u1/4.7-4.9 x/4.0-4.20}',
    )
  })

  it('writes the cue into a relative reference’s own braces, never pinning a translation', async () => {
    const hosts = await verseTextsOver('note {John 15:4-9 web inline} and {:4 inline}')

    paint(hosts[hosts.length - 1], 0)

    expect(view.state.doc.toString()).toBe(
      'note {John 15:4-9 web inline} and {:4 inline h1/4.0-4.6}',
    )
  })

  it('keeps the translation a relative reference names itself', async () => {
    const hosts = await verseTextsOver('note {John 15:4-9 inline} and {:4 web block}')

    paint(hosts[hosts.length - 1], 1)

    expect(view.state.doc.toString()).toBe(
      'note {John 15:4-9 inline} and {:4 web block h2/4.0-4.6}',
    )
  })

  it('erases a cue out of a relative reference', async () => {
    const hosts = await verseTextsOver(
      'note {John 15:4-9 web inline} and {:4 inline h1/4.0-6}',
    )

    paint(hosts[hosts.length - 1], ERASER)

    expect(view.state.doc.toString()).toBe('note {John 15:4-9 web inline} and {:4 inline}')
  })

  it('writes the first underline and pins the effective translation', async () => {
    const verseText = await verseTextOver('before {John 15:4 inline} after')

    paint(verseText, UNDERLINE_1)

    expect(view.state.doc.toString()).toBe(
      'before {John 15:4 web inline u1/4.0-4.6} after',
    )
  })

  it('leaves an explicit translation alone when underlining', async () => {
    const verseText = await verseTextOver('note {John 15:4 web inline}')

    paint(verseText, UNDERLINE_1 + 2)

    expect(view.state.doc.toString()).toBe('note {John 15:4 web inline u3/4.0-4.6}')
  })

  it('underlines over a highlight and leaves the highlight intact', async () => {
    const verseText = await verseTextOver('note {John 15:4 web inline h2/4.0-4.12}')

    paint(verseText, UNDERLINE_1)

    expect(view.state.doc.toString()).toBe(
      'note {John 15:4 web inline h2/4.0-4.12 u1/4.0-4.6}',
    )
  })

  it('erases the highlight and the underline under the selection in one write', async () => {
    const verseText = await verseTextOver(
      'note {John 15:4 web inline h1/4.0-4.12 u2/4.0-4.12}',
    )

    paint(verseText, ERASER)

    expect(view.state.doc.toString()).toBe(
      'note {John 15:4 web inline h1/4.6-4.12 u2/4.6-4.12}',
    )
  })

  it('erases an underline out of a relative reference, never pinning', async () => {
    const hosts = await verseTextsOver(
      'note {John 15:4-9 web inline} and {:4 inline u1/4.0-6}',
    )

    paint(hosts[hosts.length - 1], ERASER)

    expect(view.state.doc.toString()).toBe('note {John 15:4-9 web inline} and {:4 inline}')
  })

  it('writes the first excerpt part and pins the effective translation', async () => {
    const verseText = await verseTextOver('before {John 15:4 inline} after')

    paint(verseText, SHOW_ONLY)

    expect(view.state.doc.toString()).toBe(
      'before {John 15:4 web inline x/4.0-4.6} after',
    )
  })

  it('shows only the selection without disturbing the other cue families', async () => {
    const verseText = await verseTextOver(
      'note {John 15:4 web inline h1/4.0-4.12 u2/4.7-4.12}',
    )

    paint(verseText, SHOW_ONLY)

    expect(view.state.doc.toString()).toBe(
      'note {John 15:4 web inline h1/4.0-4.12 u2/4.7-4.12 x/4.0-4.6}',
    )
  })

  it('never pins a translation when the excerpt is made on a relative reference', async () => {
    const hosts = await verseTextsOver(
      'note {John 15:4-9 web inline} and {:4 inline}',
    )

    paint(hosts[hosts.length - 1], SHOW_ONLY)

    expect(view.state.doc.toString()).toBe(
      'note {John 15:4-9 web inline} and {:4 inline x/4.0-4.6}',
    )
  })

  it('rewrites the occurrence the stroke was made in, not its twin', async () => {
    const hosts = await verseTextsOver(
      'note {John 15:4 web inline} and {John 15:4 web inline}',
    )

    paint(hosts[1], 0)

    expect(view.state.doc.toString()).toBe(
      'note {John 15:4 web inline} and {John 15:4 web inline h1/4.0-4.6}',
    )
  })
})

describe('Passage Editing in Live Preview', () => {
  const HIDE = 12
  const CONTROL = '.scripture-study-passage-edit'
  const TOOLBAR = '.scripture-study-passage-editing-toolbar'

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

  const widgetsOver = async (doc: string): Promise<HTMLElement[]> => {
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
      const widgets = [
        ...view.contentDOM.querySelectorAll<HTMLElement>('.scripture-study-reference'),
      ].filter((widget) => widget.querySelector(CONTROL) !== null)
      if (widgets.length < expected) throw new Error('passage not rendered')
      return widgets
    })
  }

  const click = (target: Element): void => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }

  const enter = (widget: HTMLElement): void => {
    click(widget.querySelector(CONTROL)!)
  }

  const toolbarOf = (widget: HTMLElement): HTMLElement | null =>
    widget.querySelector<HTMLElement>(TOOLBAR)

  const toolbarButton = (widget: HTMLElement, label: string): HTMLElement => {
    const button = [...toolbarOf(widget)!.querySelectorAll<HTMLElement>('[role=button]')]
      .find((candidate) => candidate.textContent === label)
    if (button === undefined) throw new Error(`no ${label}`)
    return button
  }

  const selectAndChoose = (widget: HTMLElement, swatch: number): void => {
    const verseText = widget.querySelector<HTMLElement>('[data-verse-id]')!
    const text = document.createTreeWalker(verseText, NodeFilter.SHOW_TEXT)
      .nextNode() as Text
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 6)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    const swatches = document.querySelectorAll('.scripture-study-highlight-swatch')
    swatches[swatch].dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }

  // The write rebuilds the widget, so the mode lives on in a fresh one.
  const rebuiltInMode = async (): Promise<HTMLElement> =>
    await vi.waitFor(() => {
      const widget = [
        ...view.contentDOM.querySelectorAll<HTMLElement>('.scripture-study-reference'),
      ].find((candidate) => toolbarOf(candidate) !== null)
      if (widget === undefined) throw new Error('not rebuilt in the mode')
      return widget
    })

  it('Hide writes the excerpt at once and the rebuilt occurrence is still in the mode', async () => {
    const [widget] = await widgetsOver('before {John 15:4 web inline} after')

    enter(widget)
    selectAndChoose(widget, HIDE)

    expect(view.state.doc.toString()).toBe(
      'before {John 15:4 web inline x/4.6-4.12} after',
    )
    const rebuilt = await rebuiltInMode()
    expect(rebuilt.querySelector('.scripture-study-elided')?.textContent).toBe('Remain')
    expect(rebuilt.querySelector('.scripture-study-passage-ellipsis')).toBeNull()
  })

  it('Clear excerpt drops every x token and keeps the mode', async () => {
    const [widget] = await widgetsOver('note {John 15:4 web inline h1/4.0-4.6 x/4.0-4.6}')

    enter(widget)
    click(toolbarButton(widget, 'Clear excerpt'))

    expect(view.state.doc.toString()).toBe('note {John 15:4 web inline h1/4.0-4.6}')
    await rebuiltInMode()
  })

  it('Done leaves the mode and the passage renders cut to its kept parts again', async () => {
    const [widget] = await widgetsOver('note {John 15:4 web inline x/4.0-4.6}')

    enter(widget)
    expect(widget.querySelector('.scripture-study-passage-ellipsis')).toBeNull()
    click(toolbarButton(widget, 'Done'))

    expect(toolbarOf(widget)).toBeNull()
    expect(widget.querySelector('.scripture-study-passage-ellipsis')).not.toBeNull()
    expect(view.state.doc.toString()).toBe('note {John 15:4 web inline x/4.0-4.6}')
  })

  it('ends when the token is changed from elsewhere and the widget is rebuilt', async () => {
    const [widget] = await widgetsOver('note {John 15:4 web inline x/4.0-4.6}')

    enter(widget)
    view.dispatch({ changes: { from: 20, to: 26, insert: 'block' } })

    const rebuilt = await vi.waitFor(() => {
      const candidate = view.contentDOM.querySelector<HTMLElement>('.scripture-study-reference')
      if (candidate === null || candidate === widget || candidate.querySelector(CONTROL) === null)
        throw new Error('not rebuilt')
      return candidate
    })
    expect(toolbarOf(rebuilt)).toBeNull()
    expect(view.contentDOM.querySelector(TOOLBAR)).toBeNull()
  })

  it('survives an edit elsewhere in the note that leaves the token alone', async () => {
    const [widget] = await widgetsOver('note {John 15:4 web inline x/4.0-4.6}')

    enter(widget)
    view.dispatch({ changes: { from: 0, insert: 'a ' } })

    expect(view.contentDOM.querySelector(TOOLBAR)).not.toBeNull()
  })

  it('ends on the first occurrence when a second enters', async () => {
    const [first, second] = await widgetsOver(
      'note {John 15:4 web inline} and {John 15:4 web block}',
    )

    enter(first)
    enter(second)

    expect(toolbarOf(first)).toBeNull()
    expect(toolbarOf(second)).not.toBeNull()
  })

  it('edits a relative reference in its own braces, never pinning', async () => {
    const widgets = await widgetsOver('note {John 15:4-9 web inline} and {:4 inline}')
    const relative = widgets[widgets.length - 1]

    enter(relative)
    selectAndChoose(relative, HIDE)

    expect(view.state.doc.toString()).toBe(
      'note {John 15:4-9 web inline} and {:4 inline x/4.6-4.12}',
    )
    await rebuiltInMode()
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
