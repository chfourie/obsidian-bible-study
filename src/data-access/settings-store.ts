import type { Plugin } from 'obsidian'
import {
  DEFAULT_SETTINGS,
  defaultHighlightPalette,
  type ScriptureStudySettings,
} from './scripture-study-settings.type'
import { applyTranslationBootstrap } from './bootstrap-translations'
import { applyReaderDefaultMigration } from './migrate-reader-defaults'

type SettingsData = Pick<Plugin, 'loadData' | 'saveData'>

// Persisted fields of removed features — the API.Bible online tier, and the
// reader details toggle the Study Panel replaced; dropped silently on load,
// and from data.json on the next save.
const REMOVED_SETTINGS_KEYS = [
  'apiBibleKey',
  'enabledOnlineTranslationIds',
  'readerDetailsDefault',
] as const

export type SettingsListener = (settings: ScriptureStudySettings) => void

export class SettingsStore {
  readonly #listeners: SettingsListener[] = []

  constructor(private readonly plugin: SettingsData) {}

  onSettingsChanged(listener: SettingsListener): void {
    this.#listeners.push(listener)
  }

  async loadSettings(): Promise<ScriptureStudySettings> {
    const stored = (await this.plugin.loadData()) as
      | Partial<ScriptureStudySettings>
      | null
    const settings = {
      ...DEFAULT_SETTINGS,
      highlightPalette: defaultHighlightPalette(),
      ...stored,
    } as ScriptureStudySettings &
      Partial<Record<(typeof REMOVED_SETTINGS_KEYS)[number], unknown>>
    for (const key of REMOVED_SETTINGS_KEYS) delete settings[key]
    return applyTranslationBootstrap(applyReaderDefaultMigration(settings))
  }

  async updateSettings(
    update: (settings: ScriptureStudySettings) => ScriptureStudySettings,
  ): Promise<ScriptureStudySettings> {
    const settings = applyTranslationBootstrap(
      update(await this.loadSettings()),
    )
    await this.plugin.saveData(settings)
    this.#listeners.forEach((listener) => listener(settings))
    return settings
  }
}
