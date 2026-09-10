export interface NoteFileVault {
  exists(path: string): boolean
  ensureFolder(path: string): Promise<void>
  createNote(path: string, content: string): Promise<void>
  readNote(path: string): Promise<string | null>
  modifyNote(path: string, content: string): Promise<void>
  renameNote(path: string, newPath: string): Promise<void>
  trashNote(path: string): Promise<void>
}
