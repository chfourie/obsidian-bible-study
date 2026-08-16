import { describe, expect, it } from 'vitest'
import type { Plugin } from 'obsidian'
import { ObsidianModuleDataDir } from './obsidian-module-data-dir'

class FakeDataAdapter {
  readonly files = new Map<string, string>()
  readonly dirs = new Set<string>(['cfg/plugins/scripture-study'])

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.dirs.has(path)
  }

  async read(path: string): Promise<string> {
    const content = this.files.get(path)
    if (content === undefined) throw new Error(`ENOENT: ${path}`)
    return content
  }

  async write(path: string, content: string): Promise<void> {
    const parent = path.slice(0, path.lastIndexOf('/'))
    if (!this.dirs.has(parent)) throw new Error(`ENOENT: ${parent}`)
    this.files.set(path, content)
  }

  async mkdir(path: string): Promise<void> {
    const parent = path.slice(0, path.lastIndexOf('/'))
    if (!this.dirs.has(parent)) throw new Error(`ENOENT: ${parent}`)
    this.dirs.add(path)
  }

  async rmdir(path: string, recursive: boolean): Promise<void> {
    if (!recursive) throw new Error('expected recursive removal')
    if (!this.dirs.has(path)) throw new Error(`ENOENT: ${path}`)
    this.dirs.delete(path)
    for (const dir of [...this.dirs]) {
      if (dir.startsWith(`${path}/`)) this.dirs.delete(dir)
    }
    for (const file of [...this.files.keys()]) {
      if (file.startsWith(`${path}/`)) this.files.delete(file)
    }
  }

  async list(path: string): Promise<{ files: string[]; folders: string[] }> {
    if (!this.dirs.has(path)) throw new Error(`ENOENT: ${path}`)
    const folders = [...this.dirs].filter(
      (dir) => dir.startsWith(`${path}/`) && !dir.slice(path.length + 1).includes('/'),
    )
    const files = [...this.files.keys()].filter(
      (file) =>
        file.startsWith(`${path}/`) && !file.slice(path.length + 1).includes('/'),
    )
    return { files, folders }
  }
}

const setup = () => {
  const adapter = new FakeDataAdapter()
  const plugin = {
    app: { vault: { adapter, configDir: 'cfg' } },
    manifest: { id: 'scripture-study', dir: 'cfg/plugins/scripture-study' },
  } as unknown as Plugin
  return { adapter, dataDir: new ObsidianModuleDataDir(plugin) }
}

describe('ObsidianModuleDataDir', () => {
  it('round-trips a file under the plugin data dir, creating parent folders', async () => {
    const { adapter, dataDir } = setup()

    await dataDir.writeTextFile('modules/web/manifest.json', '{"id":"web"}')

    expect(await dataDir.readTextFile('modules/web/manifest.json')).toBe(
      '{"id":"web"}',
    )
    expect(
      adapter.files.get('cfg/plugins/scripture-study/modules/web/manifest.json'),
    ).toBe('{"id":"web"}')
  })

  it('reads a missing file as null', async () => {
    const { dataDir } = setup()

    expect(await dataDir.readTextFile('modules/web/manifest.json')).toBeNull()
  })

  it('lists sub-directory names, and nothing for a missing directory', async () => {
    const { dataDir } = setup()
    await dataDir.writeTextFile('modules/web/manifest.json', '{}')
    await dataDir.writeTextFile('modules/kjv/manifest.json', '{}')
    await dataDir.writeTextFile('modules/readme.txt', 'not a module')

    expect((await dataDir.listDirs('modules')).sort()).toEqual(['kjv', 'web'])
    expect(await dataDir.listDirs('cache')).toEqual([])
  })

  it('removes a directory tree, tolerating one that never existed', async () => {
    const { dataDir } = setup()
    await dataDir.writeTextFile('modules/web/manifest.json', '{}')
    await dataDir.writeTextFile('modules/web/043.json', '{}')

    await dataDir.removeDir('modules/web')
    await dataDir.removeDir('modules/web')

    expect(await dataDir.readTextFile('modules/web/manifest.json')).toBeNull()
    expect(await dataDir.listDirs('modules')).toEqual([])
  })
})
