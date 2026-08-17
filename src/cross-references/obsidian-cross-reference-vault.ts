import type { Plugin } from 'obsidian'
import type { CrossReferenceVault } from './cross-reference-vault'

export class ObsidianCrossReferenceVault implements CrossReferenceVault {
  constructor(private readonly plugin: Plugin) {}

  async read(path: string): Promise<string | null> {
    const file = this.plugin.app.vault.getFileByPath(path)
    return file === null ? null : this.plugin.app.vault.cachedRead(file)
  }
}
