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
  STRONGS_ATTRIBUTION,
  STRONGS_ETYMOLOGY_ATTRIBUTION,
  StrongsLexiconClient,
  StrongsDictionaries,
} from '../strongs'
import { VaultIndexFeature } from '../vault-index'
import { WordStudyFeature } from '../word-study'
import { PluginFeatureSet } from './plugin-feature-set'

export default class ScriptureStudyPlugin extends Plugin {
  readonly #features: PluginFeatureSet = new PluginFeatureSet()
  readonly settingsStore = new SettingsStore(this)
  #settings = DEFAULT_SETTINGS

  readonly vaultIndex = new VaultIndexFeature(this)
  readonly modules = new ModulesFeature(this, this.settingsStore, () =>
    void this.vaultIndex.reindexVault(),
  )
  readonly strongsDictionaries = new StrongsDictionaries(
    new ObsidianModuleDataDir(this),
    new StrongsLexiconClient(),
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
  readonly wordStudy = new WordStudyFeature(this, {
    dictionary: {
      installed: () => this.strongsDictionaries.isInstalled(),
      entryFor: async (strongsNumber) => {
        const found = await this.strongsDictionaries.studyEntryFor(strongsNumber)
        return found === null
          ? null
          : {
              ...found,
              entry: {
                ...found.entry,
                definition: formatDefinition(found.entry.definition),
              },
            }
      },
      install: () => this.strongsDictionaries.install(),
      attribution: STRONGS_ATTRIBUTION,
      etymologyAttribution: STRONGS_ETYMOLOGY_ATTRIBUTION,
    },
  })
  readonly studyPanel = new StudyPanelFeature(this, this.modules.store, {
    crossReferences: this.crossReferences.store,
    studyMaterial: this.reader,
    index: this.vaultIndex.index,
    wordStudy: this.wordStudy,
  })
  readonly annotations = new AnnotationsFeature(this, this.vaultIndex.index)
  readonly settingsTab = new SettingsFeature(
    this,
    this.settingsStore,
    this.modules,
    this.strongsDictionaries,
  )
  readonly ribbonMenu = new RibbonMenuFeature(this, {
    openReader: (options) => this.reader.openReader(options),
    openStudyPanel: () => this.studyPanel.openPanel(),
    installedBooks: () => this.reader.installedBooks(),
    openBook: (book, options) => this.reader.openBook(book, options),
  })

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest)
    this.annotations.usePrefill(() => this.reader.prefillReference())
    this.studyPanel.useNavigator(this.reader)
    this.studyPanel.useAnnotationPrompt((prefill) =>
      this.annotations.promptAnnotation(prefill),
    )
    this.#features.addFeature(this.vaultIndex)
    this.#features.addFeature(this.modules)
    this.#features.addFeature(this.crossReferences)
    this.#features.addFeature(this.reader)
    this.#features.addFeature(this.studyPanel)
    this.#features.addFeature(this.wordStudy)
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
    // Offline or interrupted, the module simply stays on its old format and
    // the next load tries again — never a reason to fail the plugin's own.
    void this.strongsDictionaries.rebuildIfOutdated().catch(() => {})
  }

  readonly onExternalSettingsChange = async (): Promise<void> => {
    this.#settings = await this.settingsStore.loadSettings()
    this.#features.useSettings(this.#settings)
    this.#features.onSettingsChanged()
  }

  readonly onunload = this.#features.unload
}
