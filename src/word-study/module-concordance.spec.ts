import { describe, expect, it } from 'vitest'
import {
  ModuleStore,
  type ModuleDataDir,
  type ModuleManifest,
  type NormalizedModule,
} from '../modules'
import { makeVerseId } from '../reference'
import { moduleConcordance } from './module-concordance'

class FakeModuleDataDir implements ModuleDataDir {
  readonly files = new Map<string, string>()
  readonly reads: string[] = []

  async readTextFile(path: string): Promise<string | null> {
    this.reads.push(path)
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

const manifest = (extras: Partial<ModuleManifest>): ModuleManifest => ({
  id: 'kjv',
  name: 'King James Version',
  language: 'English',
  license: 'Public Domain',
  source: 'https://bolls.life/static/translations/KJV.json',
  sourceChecksum: 'abc123',
  formatVersion: 4,
  capabilities: { strongsTagged: true },
  ...extras,
})

const kjv = (): NormalizedModule => ({
  manifest: manifest({}),
  books: new Map([
    [
      1,
      {
        [makeVerseId(1, 1, 1)]: {
          text: 'In the beginning God created the heaven and the earth.',
          tags: [
            { start: 17, end: 20, strongs: ['H0430'] },
            { start: 21, end: 28, strongs: ['H1254', 'H0853'] },
          ],
        },
        [makeVerseId(1, 1, 4)]: {
          text: 'And God saw the light, that it was good.',
          tags: [{ start: 4, end: 7, strongs: ['H0430G'] }],
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

const web = (): NormalizedModule => ({
  manifest: manifest({
    id: 'web',
    name: 'World English Bible',
    capabilities: { strongsTagged: false },
  }),
  books: new Map([[1, { [makeVerseId(1, 1, 1)]: 'In the beginning.' }]]),
})

const setup = async (
  modules: NormalizedModule[] = [kjv()],
): Promise<{ dataDir: FakeModuleDataDir; concordance: ReturnType<typeof moduleConcordance> }> => {
  const dataDir = new FakeModuleDataDir()
  const store = new ModuleStore(dataDir)
  for (const module of modules) await store.saveModule(module)
  return { dataDir, concordance: moduleConcordance(store) }
}

describe('moduleConcordance', () => {
  it('reads the translation the panel was opened from', async () => {
    const { concordance } = await setup([web(), kjv()])

    expect(await concordance.translationFor('kjv')).toEqual({
      id: 'kjv',
      name: 'King James Version',
    })
  })

  it('falls back to the first installed tagged translation', async () => {
    const { concordance } = await setup([web(), kjv()])

    expect(await concordance.translationFor('web')).toEqual({
      id: 'kjv',
      name: 'King James Version',
    })
    expect(await concordance.translationFor(null)).toEqual({
      id: 'kjv',
      name: 'King James Version',
    })
  })

  it('has no translation to read while none installed is tagged', async () => {
    const { concordance } = await setup([web()])

    expect(await concordance.translationFor('web')).toBeNull()
  })

  it('serves a family\'s verse ids from the index alone', async () => {
    const { dataDir, concordance } = await setup()
    dataDir.reads.length = 0

    const verseIds = await concordance.occurrences('kjv', 'H0430')

    expect(verseIds).toEqual([makeVerseId(1, 1, 1), makeVerseId(1, 1, 4)])
    expect(dataDir.reads).toEqual(['modules/kjv/concordance.json'])
  })

  it('answers an extended number under its family', async () => {
    const { concordance } = await setup()

    expect(await concordance.occurrences('kjv', 'H0430B')).toEqual([
      makeVerseId(1, 1, 1),
      makeVerseId(1, 1, 4),
    ])
  })

  it('renders the asked-for verses with the tagged words emphasized', async () => {
    const { concordance } = await setup()

    const verses = await concordance.versesFor('kjv', 'H0430', [
      makeVerseId(1, 1, 1),
      makeVerseId(1, 1, 4),
    ])

    expect(verses).toEqual([
      {
        verseId: makeVerseId(1, 1, 1),
        segments: [
          { text: 'In the beginning ', emphasis: false },
          { text: 'God', emphasis: true },
          { text: ' created the heaven and the earth.', emphasis: false },
        ],
      },
      {
        verseId: makeVerseId(1, 1, 4),
        segments: [
          { text: 'And ', emphasis: false },
          { text: 'God', emphasis: true },
          { text: ' saw the light, that it was good.', emphasis: false },
        ],
      },
    ])
  })

  it('emphasizes a word the family is tagged on beside another number', async () => {
    const { concordance } = await setup()

    const verses = await concordance.versesFor('kjv', 'H0853', [
      makeVerseId(1, 1, 1),
    ])

    expect(verses[0].segments).toEqual([
      { text: 'In the beginning God ', emphasis: false },
      { text: 'created', emphasis: true },
      { text: ' the heaven and the earth.', emphasis: false },
    ])
  })

  it('emphasizes the family\'s words when asked by an extended number', async () => {
    const { concordance } = await setup()

    const verses = await concordance.versesFor('kjv', 'H0430B', [
      makeVerseId(1, 1, 1),
    ])

    expect(verses[0].segments).toEqual([
      { text: 'In the beginning ', emphasis: false },
      { text: 'God', emphasis: true },
      { text: ' created the heaven and the earth.', emphasis: false },
    ])
  })

  it('reads one book file however many of its verses are asked for', async () => {
    const { dataDir, concordance } = await setup()
    dataDir.reads.length = 0

    await concordance.versesFor('kjv', 'H0430', [
      makeVerseId(1, 1, 1),
      makeVerseId(1, 1, 4),
    ])

    expect(dataDir.reads).toEqual(['modules/kjv/001.json'])
  })

  it('leaves out a verse the translation has no content for', async () => {
    const { concordance } = await setup()

    expect(
      await concordance.versesFor('kjv', 'H0430', [makeVerseId(1, 9, 9)]),
    ).toEqual([])
  })
})
