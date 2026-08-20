import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import type { ModuleDataDir } from './module-data-dir'
import {
  MODULE_FORMAT_VERSION,
  TRANSLATION_CONTENT_VERSION,
  type ModuleManifest,
} from './module-manifest'
import { ModuleStore } from './module-store'
import type { NormalizedModule } from './normalized-module'
import { reindexConcordances } from './reindex-concordances'

class FakeModuleDataDir implements ModuleDataDir {
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

const manifest = (extras: Partial<ModuleManifest> = {}): ModuleManifest => ({
  id: 'kjv',
  name: 'King James Version',
  language: 'English',
  license: 'Public Domain',
  source: 'https://bolls.life/static/translations/KJV.json',
  sourceChecksum: 'abc123',
  formatVersion: TRANSLATION_CONTENT_VERSION,
  capabilities: { strongsTagged: true },
  ...extras,
})

const taggedModule = (extras: Partial<ModuleManifest> = {}): NormalizedModule => ({
  manifest: manifest(extras),
  books: new Map([
    [
      1,
      {
        [makeVerseId(1, 1, 1)]: {
          text: 'In the beginning God created the heaven and the earth.',
          tags: [{ start: 18, end: 21, strongs: ['H0430'] }],
        },
      },
    ],
    [
      43,
      {
        [makeVerseId(43, 15, 4)]: {
          text: 'Abide in me, and I in you.',
          tags: [{ start: 0, end: 5, strongs: ['G3306'] }],
        },
      },
    ],
  ]),
})

const setup = () => {
  const dataDir = new FakeModuleDataDir()
  return { dataDir, store: new ModuleStore(dataDir) }
}

// An install that predates the concordance: content and manifest as stored,
// with no index file beside them.
const installWithoutIndex = async (
  store: ModuleStore,
  dataDir: FakeModuleDataDir,
  extras: Partial<ModuleManifest> = {},
): Promise<void> => {
  await store.saveModule(taggedModule(extras))
  dataDir.files.delete(`modules/${extras.id ?? 'kjv'}/concordance.json`)
}

describe('reindexConcordances', () => {
  it('indexes an installed tagged translation that has no index yet', async () => {
    const { dataDir, store } = setup()
    await installWithoutIndex(store, dataDir)

    await reindexConcordances(store)

    expect(await store.occurrences('kjv', 'H0430')).toEqual([
      makeVerseId(1, 1, 1),
    ])
    expect(await store.occurrences('kjv', 'G3306')).toEqual([
      makeVerseId(43, 15, 4),
    ])
  })

  it('carries a content-complete install up to the current module format', async () => {
    const { dataDir, store } = setup()
    await installWithoutIndex(store, dataDir)

    await reindexConcordances(store)

    expect((await store.manifest('kjv'))?.formatVersion).toBe(
      MODULE_FORMAT_VERSION,
    )
  })

  it('leaves an install older than the current content behind its format', async () => {
    const { dataDir, store } = setup()
    await installWithoutIndex(store, dataDir, {
      formatVersion: TRANSLATION_CONTENT_VERSION - 1,
    })

    await reindexConcordances(store)

    expect((await store.manifest('kjv'))?.formatVersion).toBe(
      TRANSLATION_CONTENT_VERSION - 1,
    )
    expect(await store.occurrences('kjv', 'H0430')).toEqual([
      makeVerseId(1, 1, 1),
    ])
  })

  it('leaves an already indexed translation untouched', async () => {
    const { dataDir, store } = setup()
    await store.saveModule(taggedModule({ formatVersion: MODULE_FORMAT_VERSION }))
    dataDir.writes.length = 0

    await reindexConcordances(store)

    expect(dataDir.writes).toEqual([])
  })

  it('never indexes a translation that carries no tags', async () => {
    const { dataDir, store } = setup()
    await store.saveModule({
      ...taggedModule({ id: 'web', capabilities: { strongsTagged: false } }),
    })
    dataDir.writes.length = 0

    await reindexConcordances(store)

    expect(dataDir.writes).toEqual([])
    expect(await store.hasConcordance('web')).toBe(false)
  })
})
