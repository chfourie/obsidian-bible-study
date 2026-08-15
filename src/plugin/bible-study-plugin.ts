import { App, Plugin, type PluginManifest } from 'obsidian'
import { PluginFeatureSet } from './plugin-feature-set'

export default class BibleStudyPlugin extends Plugin {
  readonly #features: PluginFeatureSet = new PluginFeatureSet()

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest)
    // Features register here as they land (parser, reader, annotations, …).
  }

  readonly onExternalSettingsChange = this.#features.onExternalSettingsChange
  readonly onload = this.#features.load
  readonly onunload = this.#features.unload
}
