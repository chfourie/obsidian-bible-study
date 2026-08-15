import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import type { ModuleDataDir } from './module-data-dir'
import type { ModuleManifest } from './module-manifest'
import { ModuleStore } from './module-store'
import type { NormalizedModule } from './normalize-getbible-translation'

class FakeModuleDataDir implements ModuleDataDir {
  readonly files = new Map<string, string>()

  async readTextFile(path: string): Promise<string | null> {
    return this.files.get(path) ?? null
  }

  async writeTextFile(path: string, content: string): Promise<void> {
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

const webManifest = (): ModuleManifest => ({
  id: 'web',
  name: 'World English Bible',
  language: 'English',
  license: 'Public Domain',
  source: 'https://api.getbible.net/v2/web.json',
  sourceChecksum: 'abc123',
  formatVersion: 1,
  capabilities: { strongsTagged: false },
})

const webModule = (): NormalizedModule => ({
  manifest: webManifest(),
  books: new Map([
    [
      43,
      {
        [makeVerseId(43, 15, 4)]: 'Remain in me, and I in you.',
        [makeVerseId(43, 15, 5)]: 'I am the vine. You are the branches.',
      },
    ],
    [64, { [makeVerseId(64, 1, 1)]: 'The elder to Gaius the beloved.' }],
  ]),
})

const setup = () => {
  const dataDir = new FakeModuleDataDir()
  const store = new ModuleStore(dataDir)
  return { dataDir, store }
}

describe('ModuleStore', () => {
  it('reads back the manifest of a saved module', async () => {
    const { store } = setup()

    await store.saveModule(webModule())

    expect(await store.manifest('web')).toEqual(webManifest())
  })

  it('serves verse text by verse id from a saved module', async () => {
    const { store } = setup()
    await store.saveModule(webModule())

    expect(await store.verseText('web', makeVerseId(43, 15, 4))).toBe(
      'Remain in me, and I in you.',
    )
    expect(await store.verseText('web', makeVerseId(64, 1, 1))).toBe(
      'The elder to Gaius the beloved.',
    )
  })

  it('treats content gaps and missing modules as absent verses', async () => {
    const { store } = setup()
    await store.saveModule(webModule())

    expect(await store.verseText('web', makeVerseId(43, 15, 6))).toBeNull()
    expect(await store.verseText('web', makeVerseId(1, 1, 1))).toBeNull()
    expect(await store.verseText('kjv', makeVerseId(43, 15, 4))).toBeNull()
  })
})
