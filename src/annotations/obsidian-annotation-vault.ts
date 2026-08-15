import type { Plugin } from 'obsidian'
import type { AnnotationVault } from './annotation-vault'

export class ObsidianAnnotationVault implements AnnotationVault {
  constructor(private readonly plugin: Plugin) {}

  exists(path: string): boolean {
    return this.plugin.app.vault.getAbstractFileByPath(path) !== null
  }

  async ensureFolder(path: string): Promise<void> {
    if (this.plugin.app.vault.getAbstractFileByPath(path) !== null) return
    await this.plugin.app.vault.createFolder(path)
  }

  async createNote(path: string, content: string): Promise<void> {
    await this.plugin.app.vault.create(path, content)
  }

  async readNote(path: string): Promise<string | null> {
    const file = this.plugin.app.vault.getFileByPath(path)
    return file === null ? null : this.plugin.app.vault.cachedRead(file)
  }
}
