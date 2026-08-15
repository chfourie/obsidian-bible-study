import { App, Plugin, type PluginManifest } from 'obsidian'
import { AnnotationsFeature } from '../annotations'
import { SettingsStore } from '../data-access'
import { apiBibleIdFor, ModulesFeature } from '../modules'
import { ReaderFeature } from '../reader'
import { OnlinePassageSource, RenderingFeature } from '../rendering'
import { VaultIndexFeature } from '../vault-index'
import { PluginFeatureSet } from './plugin-feature-set'

export default class BibleStudyPlugin extends Plugin {
  readonly #features: PluginFeatureSet = new PluginFeatureSet()
  readonly settingsStore = new SettingsStore(this)

  readonly vaultIndex = new VaultIndexFeature(this)
  readonly modules = new ModulesFeature(this, this.settingsStore)
  readonly #onlineSource = new OnlinePassageSource({
    client: this.modules.apiBibleClient,
    cache: this.modules.passageCache,
    reportFums: (fumsToken) => void this.modules.fumsReporter.report(fumsToken),
    apiBibleIdFor,
  })
  readonly reader = new ReaderFeature(
    this,
    this.modules.store,
    this.vaultIndex.index,
    this.#onlineSource,
  )
  readonly rendering = new RenderingFeature(
    this,
    this.modules.store,
    this.reader,
    this.#onlineSource,
    this.vaultIndex.index,
  )
  readonly annotations = new AnnotationsFeature(this, this.vaultIndex.index)

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest)
    this.annotations.usePrefill(() => this.reader.prefillReference())
    this.reader.useAnnotator(
      (reference) => void this.annotations.annotate(reference),
    )
    this.#features.addFeature(this.vaultIndex)
    this.#features.addFeature(this.modules)
    this.#features.addFeature(this.reader)
    this.#features.addFeature(this.rendering)
    this.#features.addFeature(this.annotations)
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
