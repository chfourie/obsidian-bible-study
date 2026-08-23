import { EditorState, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MarkdownView,
  Platform,
  editorLivePreviewField,
  type MarkdownPostProcessorContext,
  type Plugin,
} from 'obsidian'
import { NOOP_REFERENCE_NAVIGATOR } from '../contracts'
import { DEFAULT_SETTINGS } from '../data-access'
import type { ModuleStore } from '../modules'
import { VaultReferenceIndex } from '../vault-index'
import { renderContextChangedEffect } from './live-preview-extension'
import { RenderingFeature } from './rendering-feature'

const markdownView = (editor: unknown): MarkdownView =>
  Object.assign(new (MarkdownView as unknown as new () => MarkdownView)(), {
    editor,
  })

const featureOverLeaves = (leaves: { view: unknown }[]): RenderingFeature => {
  const plugin = {
    app: {
      workspace: {
        iterateAllLeaves: (callback: (leaf: { view: unknown }) => void) =>
          leaves.forEach(callback),
      },
    },
  } as unknown as Plugin
  return new RenderingFeature(plugin, {} as ModuleStore)
}

describe('RenderingFeature in-note intersections', () => {
  it('surfaces intersecting notes on rendered references, excluding the note itself', async () => {
    type PostProcessor = (
      element: HTMLElement,
      context: MarkdownPostProcessorContext,
    ) => Promise<void>
    let postProcessor: PostProcessor | null = null
    const plugin = {
      registerMarkdownPostProcessor: (processor: PostProcessor) => {
        postProcessor = processor
      },
      registerEditorExtension: () => {},
      registerEditorSuggest: () => {},
    } as unknown as Plugin
    const index = new VaultReferenceIndex()
    index.indexNote('Sermons/Abiding.md', 'On {John 15:4} we see')
    index.indexNote('Topics/Union.md', '{John 15:1-17}')
    index.indexNote('Annotations/John 15.4.md', '---\nref: John 15:4\n---\n')
    const feature = new RenderingFeature(
      plugin,
      {} as ModuleStore,
      NOOP_REFERENCE_NAVIGATOR,
      index,
    )
    await feature.load()

    const element = document.createElement('div')
    element.innerHTML = '<p>{John 15:4}</p>'
    await postProcessor!(element, {
      sourcePath: 'Sermons/Abiding.md',
      getSectionInfo: () => null,
    } as unknown as MarkdownPostProcessorContext)

    const toggle = element.querySelector('.scripture-study-intersections-toggle')
    expect(toggle?.textContent).toBe('●1◆1')
  })
})

describe('RenderingFeature reading mode sections', () => {
  it('resolves a relative reference against an anchor in an earlier section', async () => {
    type PostProcessor = (
      element: HTMLElement,
      context: MarkdownPostProcessorContext,
    ) => Promise<void>
    let postProcessor: PostProcessor | undefined
    const plugin = {
      registerMarkdownPostProcessor: (processor: PostProcessor) => {
        postProcessor = processor
      },
      registerEditorExtension: () => {},
      registerEditorSuggest: () => {},
      app: { workspace: { iterateAllLeaves: () => {} } },
    } as unknown as Plugin
    const feature = new RenderingFeature(plugin, {} as ModuleStore)
    await feature.load()

    const text = '# A\n{John 15:4-9}\n\n## B\n{:5} bears fruit.\n'
    const element = document.createElement('div')
    element.innerHTML = '<p>{:5} bears fruit.</p>'
    await postProcessor!(element, {
      sourcePath: 'note.md',
      getSectionInfo: () => ({ text, lineStart: 4, lineEnd: 4 }),
    } as unknown as MarkdownPostProcessorContext)

    expect(element.querySelector('.scripture-study-chip-ref')?.textContent).toBe(
      '[:5]',
    )
  })
})

describe('RenderingFeature derived red letter', () => {
  it('renders cue-marked verses red in notes when enabled for a module without native red letter', async () => {
    type PostProcessor = (
      element: HTMLElement,
      context: MarkdownPostProcessorContext,
    ) => Promise<void>
    let postProcessor: PostProcessor | null = null
    const plugin = {
      registerMarkdownPostProcessor: (processor: PostProcessor) => {
        postProcessor = processor
      },
      registerEditorExtension: () => {},
      registerEditorSuggest: () => {},
    } as unknown as Plugin
    const store = {
      manifest: async (moduleId: string) =>
        moduleId === 'web'
          ? {
              id: 'web',
              name: 'World English Bible',
              language: 'English',
              license: 'Public Domain',
              source: 'test',
              sourceChecksum: '',
              formatVersion: 1,
              capabilities: { strongsTagged: false },
            }
          : null,
      bookContent: async (moduleId: string, book: number) =>
        moduleId === 'web' && book === 43
          ? { [43015004]: 'Remain in me, and I in you.' }
          : null,
    } as unknown as ModuleStore
    const feature = new RenderingFeature(plugin, store)
    feature.useSettings({
      ...DEFAULT_SETTINGS,
      defaultTranslationId: 'web',
      derivedRedLetter: true,
    })
    await feature.load()

    const element = document.createElement('div')
    element.innerHTML = '<p>{John 15:4 inline}</p>'
    await postProcessor!(element, {
      sourcePath: 'note.md',
      getSectionInfo: () => null,
    } as unknown as MarkdownPostProcessorContext)

    const red = element.querySelector('.scripture-study-red-letter')
    expect(red?.textContent).toBe('Remain in me, and I in you.')
  })
})

describe('RenderingFeature highlight editing surfaces', () => {
  type Registrations = {
    postProcessor: (
      element: HTMLElement,
      context: MarkdownPostProcessorContext,
    ) => Promise<void>
    editorExtension: Extension
  }

  const passageStore = {
    manifest: async () => ({
      id: 'web',
      name: 'World English Bible',
      language: 'English',
      license: 'Public Domain',
      source: 'test',
      sourceChecksum: '',
      formatVersion: 1,
      capabilities: { strongsTagged: false },
    }),
    bookContent: async () => ({ [43015004]: 'Remain in me' }),
  } as unknown as ModuleStore

  const loadFeature = async (): Promise<Registrations> => {
    const registrations = {} as Registrations
    const plugin = {
      registerMarkdownPostProcessor: (processor: Registrations['postProcessor']) => {
        registrations.postProcessor = processor
      },
      registerEditorExtension: (extension: Extension) => {
        registrations.editorExtension = extension
      },
      registerEditorSuggest: () => {},
    } as unknown as Plugin
    const feature = new RenderingFeature(plugin, passageStore)
    feature.useSettings({ ...DEFAULT_SETTINGS, defaultTranslationId: 'web' })
    await feature.load()
    return registrations
  }

  let view: EditorView | null = null

  const livePreviewPassage = async (
    extension: Extension,
  ): Promise<HTMLElement> => {
    view = new EditorView({
      state: EditorState.create({
        doc: 'note {John 15:4 web inline}',
        extensions: [editorLivePreviewField, extension],
      }),
      parent: document.body,
    })
    const editor = view
    return await vi.waitFor(() => {
      const host = editor.contentDOM.querySelector<HTMLElement>(
        '.scripture-study-passage',
      )
      if (!host?.querySelector('[data-verse-id]')) {
        throw new Error('passage not rendered')
      }
      return host
    })
  }

  afterEach(() => {
    view?.destroy()
    view = null
    Platform.isMobile = false
    document.body.replaceChildren()
  })

  it('makes Live Preview passages editable on desktop', async () => {
    const { editorExtension } = await loadFeature()

    const passage = await livePreviewPassage(editorExtension)

    expect(passage.classList).toContain('scripture-study-highlight-editable')
  })

  it('leaves Live Preview passages read-only on mobile', async () => {
    Platform.isMobile = true
    const { editorExtension } = await loadFeature()

    const passage = await livePreviewPassage(editorExtension)

    expect(passage.classList).not.toContain('scripture-study-highlight-editable')
  })

  it('leaves Reading-mode passages read-only', async () => {
    const { postProcessor } = await loadFeature()
    const element = document.createElement('div')
    element.createEl('p').setText('{John 15:4 web inline}')

    await postProcessor(element, {
      sourcePath: 'note.md',
      getSectionInfo: () => null,
    } as unknown as MarkdownPostProcessorContext)

    const passage = element.querySelector('.scripture-study-passage')
    expect(passage?.querySelector('[data-verse-id]')).not.toBeNull()
    expect(passage?.classList).not.toContain(
      'scripture-study-highlight-editable',
    )
  })
})

describe('RenderingFeature settings changes', () => {
  it('refreshes every markdown editor so stale widgets redraw', () => {
    const first = vi.fn()
    const second = vi.fn()
    const feature = featureOverLeaves([
      { view: markdownView({ cm: { dispatch: first } }) },
      { view: markdownView({ cm: { dispatch: second } }) },
    ])

    feature.onSettingsChanged()

    for (const dispatch of [first, second]) {
      expect(dispatch).toHaveBeenCalledTimes(1)
      const { effects } = dispatch.mock.calls[0][0] as {
        effects: { is: (effect: unknown) => boolean }
      }
      expect(effects.is(renderContextChangedEffect)).toBe(true)
    }
  })

  it('rerenders reading views so stale passages redraw', () => {
    const rerender = vi.fn()
    const view = Object.assign(markdownView({}), {
      previewMode: { rerender },
    })
    const feature = featureOverLeaves([{ view }])

    feature.onSettingsChanged()

    expect(rerender).toHaveBeenCalledWith(true)
  })

  it('skips non-markdown leaves and editors without a CodeMirror view', () => {
    const feature = featureOverLeaves([
      { view: {} },
      { view: markdownView({}) },
    ])

    expect(() => feature.onSettingsChanged()).not.toThrow()
  })
})
