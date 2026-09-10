import type { Plugin, TFile } from 'obsidian'
import type { NoteFileVault } from './note-file-vault'

export class ObsidianNoteFileVault implements NoteFileVault {
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

  async modifyNote(path: string, content: string): Promise<void> {
    await this.plugin.app.vault.modify(this.#file(path), content)
  }

  // Through the file manager so links to the note follow it, as a rename in
  // the file explorer would.
  async renameNote(path: string, newPath: string): Promise<void> {
    await this.plugin.app.fileManager.renameFile(this.#file(path), newPath)
  }

  // The user's own trash preference (system or .trash/) decides where the
  // note goes.
  async trashNote(path: string): Promise<void> {
    await this.plugin.app.fileManager.trashFile(this.#file(path))
  }

  #file(path: string): TFile {
    const file = this.plugin.app.vault.getFileByPath(path)
    if (file === null) throw new Error(`${path} is not in the vault.`)
    return file
  }
}
