import { App, Plugin, type PluginManifest } from 'obsidian'
import { VaultIndexFeature } from '../vault-index'
import { PluginFeatureSet } from './plugin-feature-set'

export default class BibleStudyPlugin extends Plugin {
  readonly #features: PluginFeatureSet = new PluginFeatureSet()

  readonly vaultIndex = new VaultIndexFeature(this)

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest)
    // Features register here as they land (parser, reader, annotations, …).
    this.#features.addFeature(this.vaultIndex)
  }

  readonly onExternalSettingsChange = this.#features.onExternalSettingsChange
  readonly onload = this.#features.load
  readonly onunload = this.#features.unload
}
