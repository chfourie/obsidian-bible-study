import type { Plugin } from 'obsidian'
import {
  DEFAULT_SETTINGS,
  type BibleStudySettings,
} from './bible-study-settings.type'

type SettingsData = Pick<Plugin, 'loadData' | 'saveData'>

export class SettingsStore {
  constructor(private readonly plugin: SettingsData) {}

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
    return settings
  }
}
