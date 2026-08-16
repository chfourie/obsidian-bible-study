import { normalizePath, type Plugin } from 'obsidian'
import type { ModuleDataDir } from './module-data-dir'

export class ObsidianModuleDataDir implements ModuleDataDir {
  constructor(private readonly plugin: Plugin) {}

  get #root(): string {
    const { manifest, app } = this.plugin
    return manifest.dir ?? `${app.vault.configDir}/plugins/${manifest.id}`
  }

  get #adapter() {
    return this.plugin.app.vault.adapter
  }

  #fullPath(path: string): string {
    return normalizePath(`${this.#root}/${path}`)
  }

  async readTextFile(path: string): Promise<string | null> {
    const fullPath = this.#fullPath(path)
    if (!(await this.#adapter.exists(fullPath))) return null
    return this.#adapter.read(fullPath)
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    await this.#ensureParentDirs(path)
    await this.#adapter.write(this.#fullPath(path), content)
  }

  async removeDir(path: string): Promise<void> {
    const fullPath = this.#fullPath(path)
    if (!(await this.#adapter.exists(fullPath))) return
    await this.#adapter.rmdir(fullPath, true)
  }

  async listDirs(path: string): Promise<string[]> {
    const fullPath = this.#fullPath(path)
    if (!(await this.#adapter.exists(fullPath))) return []
    const { folders } = await this.#adapter.list(fullPath)
    return folders.map((folder) => folder.slice(fullPath.length + 1))
  }

  async #ensureParentDirs(path: string): Promise<void> {
    const segments = path.split('/').slice(0, -1)
    let dir = this.#root
    for (const segment of segments) {
      dir = `${dir}/${segment}`
      const normalized = normalizePath(dir)
      if (!(await this.#adapter.exists(normalized))) {
        await this.#adapter.mkdir(normalized)
      }
    }
  }
}
