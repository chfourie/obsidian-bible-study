import type { Plugin } from 'obsidian'
import { PluginFeature, type SettingsStore } from '../data-access'
import { GetBibleClient } from './getbible-client'
import { ModuleManager } from './module-manager'
import { ModuleStore } from './module-store'
import { ObsidianModuleDataDir } from './obsidian-module-data-dir'

export class ModulesFeature extends PluginFeature {
  readonly store: ModuleStore
  readonly manager: ModuleManager

  constructor(
    plugin: Plugin,
    readonly settingsStore: SettingsStore,
  ) {
    super(plugin)
    this.store = new ModuleStore(new ObsidianModuleDataDir(plugin))
    this.manager = new ModuleManager(
      new GetBibleClient(),
      this.store,
      settingsStore,
    )
  }
}
