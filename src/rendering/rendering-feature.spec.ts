import { describe, expect, it, vi } from 'vitest'
import { MarkdownView, type Plugin } from 'obsidian'
import type { ModuleStore } from '../modules'
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

describe('RenderingFeature settings changes', () => {
  it('refreshes every markdown editor so stale widgets redraw', () => {
    const first = vi.fn()
    const second = vi.fn()
    const feature = featureOverLeaves([
      { view: markdownView({ cm: { dispatch: first } }) },
      { view: markdownView({ cm: { dispatch: second } }) },
    ])

    feature.onExternalSettingsChange()

    for (const dispatch of [first, second]) {
      expect(dispatch).toHaveBeenCalledTimes(1)
      const { effects } = dispatch.mock.calls[0][0] as {
        effects: { is: (effect: unknown) => boolean }
      }
      expect(effects.is(renderContextChangedEffect)).toBe(true)
    }
  })

  it('skips non-markdown leaves and editors without a CodeMirror view', () => {
    const feature = featureOverLeaves([
      { view: {} },
      { view: markdownView({}) },
    ])

    expect(() => feature.onExternalSettingsChange()).not.toThrow()
  })
})
