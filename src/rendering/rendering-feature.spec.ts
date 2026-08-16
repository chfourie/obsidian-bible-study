import { describe, expect, it, vi } from 'vitest'
import { MarkdownView, type MarkdownPostProcessorContext, type Plugin } from 'obsidian'
import { NOOP_REFERENCE_NAVIGATOR } from '../contracts'
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
