import type { ModuleManifest } from './module-manifest'
import type { ModuleStore } from './module-store'
import { normalizeGetBibleTranslation } from './normalize-getbible-translation'
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
  ) {}

  async downloadModule(translationId: string): Promise<ModuleManifest> {
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
    return module.manifest
  }

  async modulesWithUpdates(): Promise<string[]> {
    const [installed, checksums] = await Promise.all([
      this.store.installedManifests(),
      this.source.fetchChecksums(),
    ])
    return installed
      .filter((manifest) => {
        const published = checksums[manifest.id]
        return published !== undefined && published !== manifest.sourceChecksum
      })
      .map((manifest) => manifest.id)
  }
}
