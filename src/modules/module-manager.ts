import type { SettingsStore } from '../data-access'
import type { ModuleManifest } from './module-manifest'
import type { ModuleStore } from './module-store'
import { normalizeGetBibleTranslation } from './normalize-getbible-translation'
import type { PrebuiltModuleSource } from './prebuilt-module-source'
import type { TranslationSource } from './translation-source'

export class ChecksumMismatchError extends Error {
  constructor(translationId: string) {
    super(`downloaded ${translationId} does not match its published checksum`)
    this.name = 'ChecksumMismatchError'
  }
}

export class ModuleManager {
  constructor(
    private readonly source: TranslationSource,
    private readonly store: ModuleStore,
    private readonly settingsStore: SettingsStore,
    private readonly prebuiltSources: Record<string, PrebuiltModuleSource> = {},
  ) {}

  async downloadModule(translationId: string): Promise<ModuleManifest> {
    const prebuilt = this.prebuiltSources[translationId]
    if (prebuilt !== undefined)
      return this.#downloadPrebuilt(translationId, prebuilt)
    const [download, checksums] = await Promise.all([
      this.source.fetchTranslation(translationId),
      this.source.fetchChecksums(),
    ])
    const published = checksums[translationId]
    if (published !== undefined && published !== download.checksum) {
      throw new ChecksumMismatchError(translationId)
    }
    const module = normalizeGetBibleTranslation(
      translationId,
      download.document,
      { source: download.url, sourceChecksum: download.checksum },
    )
    await this.store.saveModule(module)
    await this.#recordInstalled(translationId)
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
    await this.#recordInstalled(translationId)
    return download.module.manifest
  }

  async deleteModule(moduleId: string): Promise<void> {
    await this.store.deleteModule(moduleId)
    await this.#recordDeleted(moduleId)
  }

  async modulesWithUpdates(): Promise<string[]> {
    const [installed, checksums] = await Promise.all([
      this.store.installedManifests(),
      this.source.fetchChecksums(),
    ])
    const updated = await Promise.all(
      installed.map(async (manifest) => {
        const prebuilt = this.prebuiltSources[manifest.id]
        const published =
          prebuilt !== undefined
            ? await prebuilt.fetchChecksum()
            : (checksums[manifest.id] ?? null)
        return published !== null && published !== manifest.sourceChecksum
          ? manifest.id
          : null
      }),
    )
    return updated.filter((moduleId) => moduleId !== null)
  }

  async #recordInstalled(moduleId: string): Promise<void> {
    await this.settingsStore.updateSettings((settings) =>
      settings.installedModuleIds.includes(moduleId)
        ? settings
        : {
            ...settings,
            installedModuleIds: [...settings.installedModuleIds, moduleId],
          },
    )
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
