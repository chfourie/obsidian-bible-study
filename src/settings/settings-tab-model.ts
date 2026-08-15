import {
  DEFAULT_SETTINGS,
  installedTranslationModuleIds,
  type BibleStudySettings,
  type SettingsStore,
} from '../data-access'
import {
  isTranslationManifest,
  type DownloadableTranslation,
  type ModuleManifest,
  type OnlineTranslation,
} from '../modules'

export type SettingsCatalogEntry = DownloadableTranslation & {
  strongsTagged?: boolean
}

export type SettingsTabDeps = {
  settingsStore: Pick<SettingsStore, 'loadSettings' | 'updateSettings'>
  installedManifests: () => Promise<ModuleManifest[]>
  availableTranslations: () => Promise<SettingsCatalogEntry[]>
  onlineTranslations: readonly OnlineTranslation[]
  downloadModule: (translationId: string) => Promise<unknown>
  deleteModule: (moduleId: string) => Promise<void>
  modulesWithUpdates: () => Promise<string[]>
  clearPassageCache: (translationId: string) => Promise<void>
  strongs: {
    isInstalled: () => Promise<boolean>
    install: () => Promise<void>
    remove: () => Promise<void>
  }
}

export type TranslationOption = { id: string; label: string }

export type SettingsTabView = {
  settings: BibleStudySettings
  defaultTranslationOptions: TranslationOption[]
  fallbackTranslationOptions: TranslationOption[]
  noTranslationsAvailable: boolean
}

export class SettingsTabModel {
  #settings: BibleStudySettings = DEFAULT_SETTINGS
  #manifests: ModuleManifest[] = []

  constructor(private readonly deps: SettingsTabDeps) {}

  async refresh(): Promise<void> {
    this.#settings = await this.deps.settingsStore.loadSettings()
    this.#manifests = await this.deps.installedManifests()
  }

  get view(): SettingsTabView {
    const defaultTranslationOptions = [
      ...this.#installedTranslationOptions(),
      ...this.#enabledOnlineOptions(),
    ]
    return {
      settings: this.#settings,
      defaultTranslationOptions,
      fallbackTranslationOptions: this.#installedTranslationOptions(),
      noTranslationsAvailable: defaultTranslationOptions.length === 0,
    }
  }

  #installedTranslationOptions(): TranslationOption[] {
    const installedIds = installedTranslationModuleIds(this.#settings)
    return this.#manifests
      .filter(isTranslationManifest)
      .filter((installed) => installedIds.includes(installed.id))
      .map((installed) => ({ id: installed.id, label: installed.name }))
  }

  #enabledOnlineOptions(): TranslationOption[] {
    if (!hasApiKey(this.#settings)) return []
    return this.deps.onlineTranslations
      .filter((online) =>
        this.#settings.enabledOnlineTranslationIds.includes(online.id),
      )
      .map((online) => ({ id: online.id, label: online.name }))
  }
}

const hasApiKey = (settings: BibleStudySettings): boolean =>
  settings.apiBibleKey !== null && settings.apiBibleKey.trim() !== ''
