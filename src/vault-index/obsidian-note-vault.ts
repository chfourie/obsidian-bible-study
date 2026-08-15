import { TFile, type Plugin, type TAbstractFile } from 'obsidian'
import type { NoteVault } from './note-vault'

const isMarkdownFile = (file: TAbstractFile): file is TFile =>
  file instanceof TFile && file.extension === 'md'

export class ObsidianNoteVault implements NoteVault {
  constructor(private readonly plugin: Plugin) {}

  markdownFilePaths(): string[] {
    return this.plugin.app.vault.getMarkdownFiles().map((file) => file.path)
  }

  async readNote(path: string): Promise<string> {
    const file = this.plugin.app.vault.getFileByPath(path)
    return file ? this.plugin.app.vault.cachedRead(file) : ''
  }

  onLayoutReady(listener: () => void): void {
    this.plugin.app.workspace.onLayoutReady(listener)
  }

  onNoteChanged(listener: (path: string) => void): void {
    this.plugin.registerEvent(
      this.plugin.app.metadataCache.on('changed', (file) => {
        if (isMarkdownFile(file)) listener(file.path)
      }),
    )
  }

  onNoteRenamed(listener: (path: string, oldPath: string) => void): void {
    this.plugin.registerEvent(
      this.plugin.app.vault.on('rename', (file, oldPath) => {
        if (isMarkdownFile(file)) listener(file.path, oldPath)
      }),
    )
  }

  onNoteDeleted(listener: (path: string) => void): void {
    this.plugin.registerEvent(
      this.plugin.app.vault.on('delete', (file) => {
        if (isMarkdownFile(file)) listener(file.path)
      }),
    )
  }
}
