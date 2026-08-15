import { App, Plugin, type PluginManifest } from 'obsidian'
import { SettingsStore } from '../data-access'
import { ModulesFeature } from '../modules'
import { RenderingFeature } from '../rendering'
import { VaultIndexFeature } from '../vault-index'
import { PluginFeatureSet } from './plugin-feature-set'

export default class BibleStudyPlugin extends Plugin {
  readonly #features: PluginFeatureSet = new PluginFeatureSet()
  readonly #settingsStore = new SettingsStore(this)

  readonly vaultIndex = new VaultIndexFeature(this)
  readonly modules = new ModulesFeature(this)
  readonly rendering = new RenderingFeature(this, this.modules.store)

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest)
    // Features register here as they land (reader, annotations, …).
    this.#features.addFeature(this.vaultIndex)
    this.#features.addFeature(this.modules)
    this.#features.addFeature(this.rendering)
  }

  readonly onload = async (): Promise<void> => {
    this.#features.useSettings(await this.#settingsStore.loadSettings())
    await this.#features.load()
  }

  readonly onExternalSettingsChange = async (): Promise<void> => {
    this.#features.useSettings(await this.#settingsStore.loadSettings())
    this.#features.onExternalSettingsChange()
  }

  readonly onunload = this.#features.unload
}
