import type { Plugin } from 'obsidian'
import { PluginFeature, type SettingsStore } from '../data-access'
import { BollsClient } from './bolls-client'
import { BSB_MODULE_ID, BsbReleaseClient } from './bsb-release-client'
import { removeLegacyOnlineTierArtifacts } from './legacy-online-tier-cleanup'
import { ModuleManager } from './module-manager'
import { ModuleStore } from './module-store'
import { ObsidianModuleDataDir } from './obsidian-module-data-dir'

export class ModulesFeature extends PluginFeature {
  readonly store: ModuleStore
  readonly manager: ModuleManager
  readonly bollsClient: BollsClient
  readonly #dataDir: ObsidianModuleDataDir

  constructor(
    plugin: Plugin,
    readonly settingsStore: SettingsStore,
  ) {
    super(plugin)
    const dataDir = new ObsidianModuleDataDir(plugin)
    this.#dataDir = dataDir
    this.store = new ModuleStore(dataDir)
    this.bollsClient = new BollsClient()
    this.manager = new ModuleManager(
      this.bollsClient,
      this.store,
      settingsStore,
      { [BSB_MODULE_ID]: new BsbReleaseClient() },
    )
  }

  override async load(): Promise<void> {
    await removeLegacyOnlineTierArtifacts(this.#dataDir)
  }
}
