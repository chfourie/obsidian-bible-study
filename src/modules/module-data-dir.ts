export interface ModuleDataDir {
  readTextFile(path: string): Promise<string | null>
  writeTextFile(path: string, content: string): Promise<void>
  removeDir(path: string): Promise<void>
  listDirs(path: string): Promise<string[]>
}
