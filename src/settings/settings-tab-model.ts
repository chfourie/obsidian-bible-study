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
  busy: 'downloading' | 'removing' | null
  error: string | null
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
  strongsInstalled: boolean
  strongsBusy: boolean
  strongsError: string | null
  taggedTranslationInstalled: boolean
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export class SettingsTabModel {
  #settings: BibleStudySettings = DEFAULT_SETTINGS
  #manifests: ModuleManifest[] = []
  #catalog: SettingsCatalogEntry[] = []
  #updates: string[] = []
  readonly #busy = new Map<string, 'downloading' | 'removing'>()
  readonly #errors = new Map<string, string>()
  readonly #listeners = new Set<() => void>()
  #strongsInstalled = false
  #strongsBusy = false
  #strongsError: string | null = null

  constructor(private readonly deps: SettingsTabDeps) {}

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  #notify(): void {
    this.#listeners.forEach((listener) => listener())
  }

  async refresh(): Promise<void> {
    this.#settings = await this.deps.settingsStore.loadSettings()
    this.#manifests = await this.deps.installedManifests()
    this.#catalog = await this.deps.availableTranslations()
    this.#updates = await this.deps.modulesWithUpdates()
    this.#strongsInstalled = await this.deps.strongs.isInstalled()
    this.#notify()
  }

  async updateSettings(
    update: (settings: BibleStudySettings) => BibleStudySettings,
  ): Promise<void> {
    this.#settings = await this.deps.settingsStore.updateSettings(update)
    this.#notify()
  }

  async setApiBibleKey(key: string): Promise<void> {
    const trimmed = key.trim()
    await this.updateSettings((settings) => ({
      ...settings,
      apiBibleKey: trimmed === '' ? null : trimmed,
    }))
  }

  async setLanguageFilter(language: string): Promise<void> {
    await this.updateSettings((settings) => ({
      ...settings,
      languageFilter: language,
    }))
  }

  async setOnlineEnabled(
    translationId: string,
    enabled: boolean,
  ): Promise<void> {
    await this.updateSettings((settings) => ({
      ...settings,
      enabledOnlineTranslationIds: enabled
        ? [...new Set([...settings.enabledOnlineTranslationIds, translationId])]
        : settings.enabledOnlineTranslationIds.filter(
            (id) => id !== translationId,
          ),
    }))
  }

  async clearCache(translationId: string): Promise<void> {
    await this.deps.clearPassageCache(translationId)
    this.#notify()
  }

  async setStrongsEnabled(enabled: boolean): Promise<void> {
    this.#strongsBusy = true
    this.#strongsError = null
    this.#notify()
    try {
      if (enabled) await this.deps.strongs.install()
      else await this.deps.strongs.remove()
    } catch (error) {
      this.#strongsError = errorMessage(error)
    }
    this.#strongsBusy = false
    await this.refresh()
  }

  async download(translationId: string): Promise<void> {
    await this.#moduleAction(translationId, 'downloading', () =>
      this.deps.downloadModule(translationId),
    )
  }

  async remove(moduleId: string): Promise<void> {
    await this.#moduleAction(moduleId, 'removing', () =>
      this.deps.deleteModule(moduleId),
    )
  }

  async #moduleAction(
    moduleId: string,
    busy: 'downloading' | 'removing',
    action: () => Promise<unknown>,
  ): Promise<void> {
    this.#busy.set(moduleId, busy)
    this.#errors.delete(moduleId)
    this.#notify()
    try {
      await action()
    } catch (error) {
      this.#errors.set(moduleId, errorMessage(error))
    }
    this.#busy.delete(moduleId)
    await this.refresh()
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
      strongsInstalled: this.#strongsInstalled,
      strongsBusy: this.#strongsBusy,
      strongsError: this.#strongsError,
      taggedTranslationInstalled: this.#manifests.some(
        (installed) => installed.capabilities.strongsTagged,
      ),
    }
  }

  #downloadableRows(): TranslationRowView[] {
    const installedIds = this.#manifests
      .filter(isTranslationManifest)
      .map((installed) => installed.id)
    const listed = this.#catalog.filter(
      (entry) =>
        entry.language === this.#settings.languageFilter ||
        installedIds.includes(entry.id),
    )
    const catalogIds = listed.map((entry) => entry.id)
    const installedOnly = this.#manifests
      .filter(isTranslationManifest)
      .filter((installed) => !catalogIds.includes(installed.id))
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
      busy: this.#busy.get(entry.id) ?? null,
      error: this.#errors.get(entry.id) ?? null,
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
      busy: null,
      error: null,
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
