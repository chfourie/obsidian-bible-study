import { describe, expect, it, vi } from 'vitest'
import { MarkdownView, type MarkdownPostProcessorContext, type Plugin } from 'obsidian'
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
