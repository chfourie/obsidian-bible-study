export interface AnnotationVault {
  exists(path: string): boolean
  ensureFolder(path: string): Promise<void>
  createNote(path: string, content: string): Promise<void>
  readNote(path: string): Promise<string | null>
}
