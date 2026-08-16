import type { Plugin } from 'obsidian'
import { PluginFeature, type SettingsStore } from '../data-access'
import { ONLINE_TRANSLATIONS, type ModulesFeature } from '../modules'
import type { StrongsDictionaries } from '../strongs'
import { settingsCatalog } from './settings-catalog'
import { BibleStudySettingTab } from './settings-tab'
import { SettingsTabModel } from './settings-tab-model'

export class SettingsFeature extends PluginFeature {
  readonly model: SettingsTabModel

  constructor(
    plugin: Plugin,
    settingsStore: SettingsStore,
    modules: ModulesFeature,
    strongs: StrongsDictionaries,
  ) {
    super(plugin)
    this.model = new SettingsTabModel({
      settingsStore,
      installedManifests: () => modules.store.installedManifests(),
      availableTranslations: settingsCatalog(() =>
        modules.getBibleClient.fetchAvailableTranslations(),
      ),
      onlineTranslations: ONLINE_TRANSLATIONS,
      downloadModule: (translationId) =>
        modules.manager.downloadModule(translationId),
      deleteModule: (moduleId) => modules.manager.deleteModule(moduleId),
      modulesWithUpdates: () =>
        modules.manager.modulesWithUpdates().catch((): string[] => []),
      clearPassageCache: (translationId) =>
        modules.passageCache.clear(translationId),
      strongs,
    })
  }

  override async load(): Promise<void> {
    this.plugin.addSettingTab(new BibleStudySettingTab(this.plugin, this.model))
  }
}
