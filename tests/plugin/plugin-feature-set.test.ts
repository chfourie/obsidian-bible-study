import { describe, expect, it } from 'vitest'
import { Plugin } from 'obsidian'
import { PluginFeatureSet } from 'src/plugin/plugin-feature-set'
import { PluginFeature } from 'src/data-access'

class RecordingFeature extends PluginFeature {
  events: string[] = []

  constructor(plugin: Plugin) {
    super(plugin)
  }

  override async load(): Promise<void> {
    this.events.push('load')
  }

  override unload(): void {
    this.events.push('unload')
  }
}

class FailingFeature extends RecordingFeature {
  override async load(): Promise<void> {
    throw new Error('boom')
  }
}

const plugin = {} as Plugin

describe('PluginFeatureSet', () => {
  it('loads and unloads its features', async () => {
    const feature = new RecordingFeature(plugin)
    const features = new PluginFeatureSet().addFeature(feature)

    await features.load()
    features.unload()

    expect(feature.events).toEqual(['load', 'unload'])
  })

  it('keeps loading later features when one fails', async () => {
    const failing = new FailingFeature(plugin)
    const feature = new RecordingFeature(plugin)
    const features = new PluginFeatureSet()
      .addFeature(failing)
      .addFeature(feature)

    await features.load()

    expect(feature.events).toEqual(['load'])
  })
})
