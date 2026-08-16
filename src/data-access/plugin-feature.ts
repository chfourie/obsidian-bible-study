import type { Plugin } from 'obsidian'
import {
  DEFAULT_SETTINGS,
  type ScriptureStudySettings,
} from './scripture-study-settings.type'

export abstract class PluginFeature {
  #settings = DEFAULT_SETTINGS

  protected constructor(protected plugin: Plugin) {}

  protected get settings(): ScriptureStudySettings {
    return this.#settings
  }

  async load(): Promise<void> {}

  unload(): void {}

  onSettingsChanged(): void {}

  useSettings(settings: ScriptureStudySettings): void {
    this.#settings = settings
  }
}
