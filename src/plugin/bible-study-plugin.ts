import { App, Plugin, type PluginManifest } from 'obsidian'
import { SettingsStore } from '../data-access'
import { ModulesFeature } from '../modules'
import { ReaderFeature } from '../reader'
import { RenderingFeature } from '../rendering'
import { VaultIndexFeature } from '../vault-index'
import { PluginFeatureSet } from './plugin-feature-set'

export default class BibleStudyPlugin extends Plugin {
  readonly #features: PluginFeatureSet = new PluginFeatureSet()
  readonly settingsStore = new SettingsStore(this)

  readonly vaultIndex = new VaultIndexFeature(this)
  readonly modules = new ModulesFeature(this, this.settingsStore)
  readonly reader = new ReaderFeature(
    this,
    this.modules.store,
    this.vaultIndex.index,
  )
  readonly rendering = new RenderingFeature(this, this.modules.store, this.reader)

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest)
    // Features register here as they land (annotations, …).
    this.#features.addFeature(this.vaultIndex)
    this.#features.addFeature(this.modules)
    this.#features.addFeature(this.reader)
    this.#features.addFeature(this.rendering)
    this.settingsStore.onSettingsChanged((settings) => {
      this.#features.useSettings(settings)
      this.#features.onSettingsChanged()
    })
  }

  readonly onload = async (): Promise<void> => {
    this.#features.useSettings(await this.settingsStore.loadSettings())
    await this.#features.load()
  }

  readonly onExternalSettingsChange = async (): Promise<void> => {
    this.#features.useSettings(await this.settingsStore.loadSettings())
    this.#features.onSettingsChanged()
  }

  readonly onunload = this.#features.unload
}
