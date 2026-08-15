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

  it('lays a module out as modules/<id>/manifest.json plus zero-padded book files', async () => {
    const { dataDir, store } = setup()

    await store.saveModule(webModule())

    expect([...dataDir.files.keys()].sort()).toEqual([
      'modules/web/043.json',
      'modules/web/064.json',
      'modules/web/manifest.json',
    ])
  })

  it('lists the manifests of all installed modules', async () => {
    const { store } = setup()
    await store.saveModule(webModule())
    const kjv = webModule()
    kjv.manifest.id = 'kjv'
    kjv.manifest.name = 'King James Version'
    await store.saveModule(kjv)

    const manifests = await store.installedManifests()

    expect(manifests.map((manifest) => manifest.id).sort()).toEqual([
      'kjv',
      'web',
    ])
  })

  it('lists no modules when none are installed', async () => {
    const { store } = setup()

    expect(await store.installedManifests()).toEqual([])
  })

  it('removes a deleted module entirely', async () => {
    const { store } = setup()
    await store.saveModule(webModule())

    await store.deleteModule('web')

    expect(await store.manifest('web')).toBeNull()
    expect(await store.installedManifests()).toEqual([])
    expect(await store.verseText('web', makeVerseId(43, 15, 4))).toBeNull()
  })

  it('refuses module ids that are not a plain path segment', async () => {
    const { dataDir, store } = setup()
    const evil = webModule()
    evil.manifest.id = '../../evil'

    await expect(store.saveModule(evil)).rejects.toThrow('module id')
    await expect(store.deleteModule('../../evil')).rejects.toThrow('module id')
    await expect(store.manifest('a/b')).rejects.toThrow('module id')
    await expect(
      store.verseText('..', makeVerseId(43, 15, 4)),
    ).rejects.toThrow('module id')
    expect(dataDir.files.size).toBe(0)
  })

  it('skips directories that are not valid module ids when listing manifests', async () => {
    const { dataDir, store } = setup()
    await store.saveModule(webModule())
    dataDir.files.set('modules/str.ange dir/manifest.json', '{}')

    const manifests = await store.installedManifests()

    expect(manifests.map((manifest) => manifest.id)).toEqual(['web'])
  })

  it('leaves no manifest behind when an install is interrupted mid-write', async () => {
    const { dataDir, store } = setup()
    const originalWrite = dataDir.writeTextFile.bind(dataDir)
    dataDir.writeTextFile = async (path, content) => {
      if (path.endsWith('064.json')) throw new Error('disk full')
      await originalWrite(path, content)
    }

    await expect(store.saveModule(webModule())).rejects.toThrow('disk full')

    expect(await store.manifest('web')).toBeNull()
    expect(await store.installedManifests()).toEqual([])
  })

  it('drops content of a previous install when a module is saved again', async () => {
    const { store } = setup()
    await store.saveModule(webModule())
    const updated = webModule()
    updated.books.delete(64)

    await store.saveModule(updated)

    expect(await store.verseText('web', makeVerseId(64, 1, 1))).toBeNull()
    expect(await store.verseText('web', makeVerseId(43, 15, 4))).toBe(
      'Remain in me, and I in you.',
    )
  })
})
