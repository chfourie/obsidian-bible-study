import type { Plugin } from 'obsidian'
import type { CrossReferenceVault } from './cross-reference-vault'

export class ObsidianCrossReferenceVault implements CrossReferenceVault {
  constructor(private readonly plugin: Plugin) {}

  async read(path: string): Promise<string | null> {
    const file = this.plugin.app.vault.getFileByPath(path)
    return file === null ? null : this.plugin.app.vault.cachedRead(file)
  }

  async write(path: string, content: string): Promise<void> {
    const file = this.plugin.app.vault.getFileByPath(path)
    if (file === null) await this.plugin.app.vault.create(path, content)
    else await this.plugin.app.vault.modify(file, content)
  }
}
