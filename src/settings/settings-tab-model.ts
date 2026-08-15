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

export type TranslationRowView = {
  id: string
  name: string
  tier: 'downloadable' | 'online'
  installed: boolean
  enabled: boolean
  updateAvailable: boolean
  strongsTagged: boolean
}

export type SettingsTabView = {
  settings: BibleStudySettings
  defaultTranslationOptions: TranslationOption[]
  fallbackTranslationOptions: TranslationOption[]
  noTranslationsAvailable: boolean
  rows: TranslationRowView[]
  languages: string[]
}

export class SettingsTabModel {
  #settings: BibleStudySettings = DEFAULT_SETTINGS
  #manifests: ModuleManifest[] = []
  #catalog: SettingsCatalogEntry[] = []
  #updates: string[] = []

  constructor(private readonly deps: SettingsTabDeps) {}

  async refresh(): Promise<void> {
    this.#settings = await this.deps.settingsStore.loadSettings()
    this.#manifests = await this.deps.installedManifests()
    this.#catalog = await this.deps.availableTranslations()
    this.#updates = await this.deps.modulesWithUpdates()
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
      rows: [...this.#downloadableRows(), ...this.#onlineRows()],
      languages: [
        ...new Set(this.#catalog.map((entry) => entry.language)),
      ].sort(),
    }
  }

  #downloadableRows(): TranslationRowView[] {
    const installedIds = installedTranslationModuleIds(this.#settings)
    const listed = this.#catalog.filter(
      (entry) =>
        entry.language === this.#settings.languageFilter ||
        installedIds.includes(entry.id),
    )
    const catalogIds = listed.map((entry) => entry.id)
    const installedOnly = this.#manifests
      .filter(isTranslationManifest)
      .filter(
        (installed) =>
          installedIds.includes(installed.id) &&
          !catalogIds.includes(installed.id),
      )
      .map((installed) => ({
        id: installed.id,
        name: installed.name,
        language: installed.language,
      }))
    return [...listed, ...installedOnly].map((entry) => ({
      id: entry.id,
      name: entry.name,
      tier: 'downloadable',
      installed: installedIds.includes(entry.id),
      enabled: false,
      updateAvailable: this.#updates.includes(entry.id),
      strongsTagged:
        this.#manifests.find((installed) => installed.id === entry.id)
          ?.capabilities.strongsTagged ??
        ('strongsTagged' in entry && entry.strongsTagged === true),
    }))
  }

  #onlineRows(): TranslationRowView[] {
    if (!hasApiKey(this.#settings)) return []
    return this.deps.onlineTranslations.map((online) => ({
      id: online.id,
      name: online.name,
      tier: 'online',
      installed: false,
      enabled: this.#settings.enabledOnlineTranslationIds.includes(online.id),
      updateAvailable: false,
      strongsTagged: false,
    }))
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
