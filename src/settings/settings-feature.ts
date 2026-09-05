import type { Plugin } from 'obsidian'
import { PluginFeature, type SettingsStore } from '../data-access'
import type { ModulesFeature } from '../modules'
import type { LsjLexicon, StrongsDictionaries } from '../strongs'
import {
  applyHighlightPaletteVariables,
  removeHighlightPaletteVariables,
} from './highlight-palette-style'
import { settingsCatalog } from './settings-catalog'
import { ScriptureStudySettingTab } from './settings-tab'
import { SettingsTabModel } from './settings-tab-model'

export class SettingsFeature extends PluginFeature {
  readonly model: SettingsTabModel

  constructor(
    plugin: Plugin,
    settingsStore: SettingsStore,
    modules: ModulesFeature,
    strongs: StrongsDictionaries,
    lsj: LsjLexicon,
  ) {
    super(plugin)
    this.model = new SettingsTabModel({
      settingsStore,
      installedManifests: () => modules.store.installedManifests(),
      availableTranslations: settingsCatalog(() =>
        modules.bollsClient.fetchCatalog(),
      ),
      downloadModule: (translationId) =>
        modules.manager.downloadModule(translationId),
      deleteModule: (moduleId) => modules.manager.deleteModule(moduleId),
      modulesWithUpdates: () =>
        modules.manager.modulesWithUpdates().catch((): string[] => []),
      strongs,
      lsj,
      strongsGloss: async (family) =>
        (await strongs.entriesFor([family]))[0]?.gloss ?? null,
    })
  }

  override async load(): Promise<void> {
    this.plugin.addSettingTab(new ScriptureStudySettingTab(this.plugin, this.model))
    this.#emitHighlightPalette()
  }

  override onSettingsChanged(): void {
    this.#emitHighlightPalette()
  }

  override unload(): void {
    removeHighlightPaletteVariables(document.body)
  }

  #emitHighlightPalette(): void {
    applyHighlightPaletteVariables(
      document.body,
      this.settings.highlightPalette,
      this.settings.highlightWash,
    )
  }
}
