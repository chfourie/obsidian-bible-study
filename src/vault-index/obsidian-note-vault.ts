import { TFile, type Plugin, type TAbstractFile } from 'obsidian'
import { CROSS_REFERENCES_FILE_NAME } from '../cross-references/cross-reference-store'
import type { NoteVault } from './note-vault'

// The cross-references data file is markdown only so vault sync carries it;
// it is not a note and must never enter the reference index.
const isDataFilePath = (path: string): boolean =>
  path === CROSS_REFERENCES_FILE_NAME ||
  path.endsWith(`/${CROSS_REFERENCES_FILE_NAME}`)

const isMarkdownFile = (file: TAbstractFile): file is TFile =>
  file instanceof TFile && file.extension === 'md' && !isDataFilePath(file.path)

const isMarkdownPath = (path: string): boolean =>
  path.endsWith('.md') && !isDataFilePath(path)

export class ObsidianNoteVault implements NoteVault {
  constructor(private readonly plugin: Plugin) {}

  markdownFilePaths(): string[] {
    return this.plugin.app.vault
      .getMarkdownFiles()
      .map((file) => file.path)
      .filter((path) => !isDataFilePath(path))
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
    this.plugin.registerEvent(
      this.plugin.app.vault.on('rename', (file, oldPath) => {
        const becameNonMarkdown =
          file instanceof TFile && !isMarkdownFile(file) && isMarkdownPath(oldPath)
        if (becameNonMarkdown) listener(oldPath)
      }),
    )
  }
}
