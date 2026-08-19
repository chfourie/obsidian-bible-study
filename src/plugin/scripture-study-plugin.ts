import { App, Plugin, type PluginManifest } from 'obsidian'
import { AnnotationsFeature } from '../annotations'
import { CrossReferencesFeature } from '../cross-references'
import { DEFAULT_SETTINGS, SettingsStore } from '../data-access'
import {
  ModulesFeature,
  ObsidianModuleDataDir,
  SUGGESTED_FIRST_TRANSLATION,
} from '../modules'
import { ReaderFeature } from '../reader'
import { StudyPanelFeature } from '../study-panel'
import { RenderingFeature } from '../rendering'
import { RibbonMenuFeature } from '../ribbon-menu'
import { SettingsFeature } from '../settings'
import {
  formatDefinition,
  StepBibleLexiconClient,
  STRONGS_ATTRIBUTION,
  StrongsDictionaries,
} from '../strongs'
import { VaultIndexFeature } from '../vault-index'
import { PluginFeatureSet } from './plugin-feature-set'

export default class ScriptureStudyPlugin extends Plugin {
  readonly #features: PluginFeatureSet = new PluginFeatureSet()
  readonly settingsStore = new SettingsStore(this)
  #settings = DEFAULT_SETTINGS

  readonly vaultIndex = new VaultIndexFeature(this)
  readonly modules = new ModulesFeature(this, this.settingsStore)
  readonly strongsDictionaries = new StrongsDictionaries(
    new ObsidianModuleDataDir(this),
    new StepBibleLexiconClient(),
    this.settingsStore,
  )
  readonly installSuggestedTranslation = async (): Promise<void> => {
    await this.modules.manager.downloadModule(SUGGESTED_FIRST_TRANSLATION.id)
  }

  readonly #firstRun = {
    translationName: SUGGESTED_FIRST_TRANSLATION.name,
    install: this.installSuggestedTranslation,
  }

  readonly crossReferences = new CrossReferencesFeature(this)

  readonly reader = new ReaderFeature(
    this,
    this.modules.store,
    this.vaultIndex.index,
    {
      firstRun: this.#firstRun,
      crossReferences: this.crossReferences.store,
      strongs: {
        dictionariesInstalled: () => this.strongsDictionaries.isInstalled(),
        entriesFor: async (numbers) =>
          (await this.strongsDictionaries.entriesFor(numbers)).map((entry) => ({
            ...entry,
            definition: formatDefinition(entry.definition),
          })),
        attribution: STRONGS_ATTRIBUTION,
      },
    },
  )
  readonly rendering = new RenderingFeature(
    this,
    this.modules.store,
    this.reader,
    this.vaultIndex.index,
    this.#firstRun,
  )
  readonly studyPanel = new StudyPanelFeature(this, this.modules.store, {
    crossReferences: this.crossReferences.store,
    studyMaterial: this.reader,
  })
  readonly annotations = new AnnotationsFeature(this, this.vaultIndex.index)
  readonly settingsTab = new SettingsFeature(
    this,
    this.settingsStore,
    this.modules,
    this.strongsDictionaries,
  )
  readonly ribbonMenu = new RibbonMenuFeature(this, {
    openReader: () => this.reader.openReader(),
    openStudyPanel: () => this.studyPanel.openPanel(),
  })

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest)
    this.annotations.usePrefill(() => this.reader.prefillReference())
    this.reader.useAnnotator(
      (reference) => void this.annotations.annotate(reference),
    )
    this.studyPanel.useNavigator(this.reader)
    this.studyPanel.useAnnotator(
      (reference) => void this.annotations.annotate(reference),
    )
    this.#features.addFeature(this.vaultIndex)
    this.#features.addFeature(this.modules)
    this.#features.addFeature(this.crossReferences)
    this.#features.addFeature(this.reader)
    this.#features.addFeature(this.studyPanel)
    this.#features.addFeature(this.rendering)
    this.#features.addFeature(this.annotations)
    this.#features.addFeature(this.settingsTab)
    this.#features.addFeature(this.ribbonMenu)
    this.settingsStore.onSettingsChanged((settings) => {
      this.#settings = settings
      this.#features.useSettings(settings)
      this.#features.onSettingsChanged()
    })
  }

  readonly onload = async (): Promise<void> => {
    this.#settings = await this.settingsStore.loadSettings()
    this.#features.useSettings(this.#settings)
    await this.#features.load()
  }

  readonly onExternalSettingsChange = async (): Promise<void> => {
    this.#settings = await this.settingsStore.loadSettings()
    this.#features.useSettings(this.#settings)
    this.#features.onSettingsChanged()
  }

  readonly onunload = this.#features.unload
}
