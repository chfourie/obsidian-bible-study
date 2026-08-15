import type { Plugin } from 'obsidian'
import {
  DEFAULT_SETTINGS,
  type BibleStudySettings,
} from './bible-study-settings.type'

type SettingsData = Pick<Plugin, 'loadData' | 'saveData'>

export type SettingsListener = (settings: BibleStudySettings) => void

export class SettingsStore {
  readonly #listeners: SettingsListener[] = []

  constructor(private readonly plugin: SettingsData) {}

  onSettingsChanged(listener: SettingsListener): void {
    this.#listeners.push(listener)
  }

  async loadSettings(): Promise<BibleStudySettings> {
    const stored = (await this.plugin.loadData()) as
      | Partial<BibleStudySettings>
      | null
    return { ...DEFAULT_SETTINGS, ...stored }
  }

  async updateSettings(
    update: (settings: BibleStudySettings) => BibleStudySettings,
  ): Promise<BibleStudySettings> {
    const settings = update(await this.loadSettings())
    await this.plugin.saveData(settings)
    this.#listeners.forEach((listener) => listener(settings))
    return settings
  }
}
