import type { Plugin } from 'obsidian'
import { PluginFeature, type SettingsStore } from '../data-access'
import { BSB_MODULE_ID, BsbReleaseClient } from './bsb-release-client'
import { GetBibleClient } from './getbible-client'
import { ModuleManager } from './module-manager'
import { ModuleStore } from './module-store'
import { ObsidianModuleDataDir } from './obsidian-module-data-dir'

export class ModulesFeature extends PluginFeature {
  readonly store: ModuleStore
  readonly manager: ModuleManager
  readonly getBibleClient: GetBibleClient

  constructor(
    plugin: Plugin,
    readonly settingsStore: SettingsStore,
  ) {
    super(plugin)
    const dataDir = new ObsidianModuleDataDir(plugin)
    this.store = new ModuleStore(dataDir)
    this.getBibleClient = new GetBibleClient()
    this.manager = new ModuleManager(
      this.getBibleClient,
      this.store,
      settingsStore,
      { [BSB_MODULE_ID]: new BsbReleaseClient() },
    )
  }
}
