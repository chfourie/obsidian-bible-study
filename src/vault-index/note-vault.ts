export interface NoteVault {
  markdownFilePaths(): string[]
  readNote(path: string): Promise<string>
  frontmatterRef(path: string): string | null
  onLayoutReady(listener: () => void): void
  onNoteChanged(listener: (path: string) => void): void
  onNoteRenamed(listener: (path: string, oldPath: string) => void): void
  onNoteDeleted(listener: (path: string) => void): void
}
