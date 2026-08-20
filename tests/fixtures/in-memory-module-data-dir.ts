import type { ModuleDataDir } from '../../src/modules'

// The module data directory as a Map, for specs that install modules without
// touching a vault. Writes are recorded in order, so a spec can tell a file
// that was rewritten from one that was left alone.
export class InMemoryModuleDataDir implements ModuleDataDir {
  readonly files = new Map<string, string>()
  readonly writes: string[] = []

  async readTextFile(path: string): Promise<string | null> {
    return this.files.get(path) ?? null
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    this.writes.push(path)
    this.files.set(path, content)
  }

  async removeDir(path: string): Promise<void> {
    for (const file of [...this.files.keys()]) {
      if (file.startsWith(`${path}/`)) this.files.delete(file)
    }
  }

  async listDirs(path: string): Promise<string[]> {
    const dirs = new Set<string>()
    for (const file of this.files.keys()) {
      if (!file.startsWith(`${path}/`)) continue
      const rest = file.slice(path.length + 1)
      const slash = rest.indexOf('/')
      if (slash > 0) dirs.add(rest.slice(0, slash))
    }
    return [...dirs]
  }
}
