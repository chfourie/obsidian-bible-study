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
    if (file === null) {
      await this.#ensureParentFolder(path)
      await this.plugin.app.vault.create(path, content)
    } else {
      await this.plugin.app.vault.modify(file, content)
    }
  }

  async rename(from: string, to: string): Promise<void> {
    const file = this.plugin.app.vault.getFileByPath(from)
    if (file === null) return
    await this.#ensureParentFolder(to)
    await this.plugin.app.vault.rename(file, to)
  }

  async #ensureParentFolder(path: string): Promise<void> {
    const segments = path.split('/').slice(0, -1)
    let dir = ''
    for (const segment of segments) {
      dir = dir === '' ? segment : `${dir}/${segment}`
      if (this.plugin.app.vault.getFolderByPath(dir) === null) {
        // A concurrent create loses the race harmlessly; the folder exists.
        await this.plugin.app.vault.createFolder(dir).catch(() => undefined)
      }
    }
  }
}
