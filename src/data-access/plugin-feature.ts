import type { Plugin } from 'obsidian'
import {
  DEFAULT_SETTINGS,
  type BibleStudySettings,
} from './bible-study-settings.type'

export abstract class PluginFeature {
  #settings = DEFAULT_SETTINGS

  protected constructor(protected plugin: Plugin) {}

  protected get settings(): BibleStudySettings {
    return this.#settings
  }

  async load(): Promise<void> {}

  unload(): void {}

  onSettingsChanged(): void {}

  useSettings(settings: BibleStudySettings): void {
    this.#settings = settings
  }
}
