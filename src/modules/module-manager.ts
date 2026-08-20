import type { SettingsStore } from '../data-access'
import {
  deregisterManifestBook,
  registerManifestBook,
} from './book-registration'
import type { ModuleManifest } from './module-manifest'
import type { ModuleStore } from './module-store'
import type { PrebuiltModuleSource } from './prebuilt-module-source'
import type { TranslationSource } from './translation-source'

// Building the freshly saved module's search index, so the first search
// against it answers straight away. Search owns the how; install only says
// when.
export type ModuleIndexer = (moduleId: string) => Promise<void>

export class ChecksumMismatchError extends Error {
  constructor(translationId: string) {
    super(`downloaded ${translationId} does not match its published checksum`)
    this.name = 'ChecksumMismatchError'
  }
}

export class ModuleManager {
  #indexModule: ModuleIndexer = async () => {}

  constructor(
    private readonly source: TranslationSource,
    private readonly store: ModuleStore,
    private readonly settingsStore: SettingsStore,
    private readonly prebuiltSources: Record<string, PrebuiltModuleSource> = {},
    private readonly onModulesChanged: () => void = () => {},
  ) {}

  useIndexer(indexer: ModuleIndexer): void {
    this.#indexModule = indexer
  }

  async downloadModule(translationId: string): Promise<ModuleManifest> {
    const prebuilt = this.prebuiltSources[translationId]
    if (prebuilt !== undefined)
      return this.#downloadPrebuilt(translationId, prebuilt)
    const module = await this.source.fetchModule(translationId)
    await this.store.saveModule(module)
    await this.#completeInstall(translationId, module.manifest)
    return module.manifest
  }

  async #downloadPrebuilt(
    translationId: string,
    prebuilt: PrebuiltModuleSource,
  ): Promise<ModuleManifest> {
    const [download, published] = await Promise.all([
      prebuilt.fetchModule(),
      prebuilt.fetchChecksum(),
    ])
    if (published !== null && published !== download.checksum) {
      throw new ChecksumMismatchError(translationId)
    }
    await this.store.saveModule(download.module)
    await this.#completeInstall(translationId, download.module.manifest)
    return download.module.manifest
  }

  async deleteModule(moduleId: string): Promise<void> {
    const manifest = await this.store.manifest(moduleId)
    await this.store.deleteModule(moduleId)
    await this.#recordDeleted(moduleId)
    if (manifest !== null) deregisterManifestBook(manifest)
    this.onModulesChanged()
  }

  // Catalogue modules never appear here: bolls publishes no checksums, so
  // updating one is an ordinary re-download. Only prebuilt sources publish
  // checksums to compare against.
  async modulesWithUpdates(): Promise<string[]> {
    const installed = await this.store.installedManifests()
    const updated = await Promise.all(
      installed.map(async (manifest) => {
        const prebuilt = this.prebuiltSources[manifest.id]
        if (prebuilt === undefined) return null
        const published = await prebuilt.fetchChecksum()
        return published !== null && published !== manifest.sourceChecksum
          ? manifest.id
          : null
      }),
    )
    return updated.filter((moduleId) => moduleId !== null)
  }

  async #completeInstall(
    moduleId: string,
    manifest: ModuleManifest,
  ): Promise<void> {
    await this.settingsStore.updateSettings((settings) =>
      settings.installedModuleIds.includes(moduleId)
        ? settings
        : {
            ...settings,
            installedModuleIds: [...settings.installedModuleIds, moduleId],
          },
    )
    registerManifestBook(manifest)
    await this.#buildSearchIndex(moduleId)
    this.onModulesChanged()
  }

  // A module that cannot be indexed here is still installed and usable: the
  // first search against it builds the index the slow way instead.
  async #buildSearchIndex(moduleId: string): Promise<void> {
    try {
      await this.#indexModule(moduleId)
    } catch (error) {
      console.error(`failed to index ${moduleId} after install`, error)
    }
  }

  async #recordDeleted(moduleId: string): Promise<void> {
    await this.settingsStore.updateSettings((settings) => ({
      ...settings,
      installedModuleIds: settings.installedModuleIds.filter(
        (id) => id !== moduleId,
      ),
    }))
  }
}
