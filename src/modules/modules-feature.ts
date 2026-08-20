import type { Plugin } from 'obsidian'
import { PluginFeature, type SettingsStore } from '../data-access'
import { BollsClient } from './bolls-client'
import { BOOK_CATALOGUE, bookRelease } from './book-catalogue'
import { registerManifestVersification } from './book-versification'
import { BSB_MODULE_ID, BSB_RELEASE } from './bsb-release'
import { removeLegacyOnlineTierArtifacts } from './legacy-online-tier-cleanup'
import { ModuleManager } from './module-manager'
import { ModuleStore } from './module-store'
import { ObsidianModuleDataDir } from './obsidian-module-data-dir'
import type { PrebuiltModuleSource } from './prebuilt-module-source'
import { PrebuiltReleaseClient } from './prebuilt-release-client'

const prebuiltSources = (): Record<string, PrebuiltModuleSource> => ({
  [BSB_MODULE_ID]: new PrebuiltReleaseClient(BSB_RELEASE),
  ...Object.fromEntries(
    BOOK_CATALOGUE.map((entry) => [
      entry.moduleId,
      new PrebuiltReleaseClient(bookRelease(entry)),
    ]),
  ),
})

export class ModulesFeature extends PluginFeature {
  readonly store: ModuleStore
  readonly manager: ModuleManager
  readonly bollsClient: BollsClient
  readonly #dataDir: ObsidianModuleDataDir

  constructor(
    plugin: Plugin,
    readonly settingsStore: SettingsStore,
    onModulesChanged: () => void = () => {},
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
      prebuiltSources(),
      onModulesChanged,
    )
  }

  override async load(): Promise<void> {
    await removeLegacyOnlineTierArtifacts(this.#dataDir)
    for (const manifest of await this.store.installedManifests()) {
      registerManifestVersification(manifest)
    }
  }
}
