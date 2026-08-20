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
        [makeVerseId(1, 2, 4)]: {
          text: 'the day that the LORD God made the earth.',
          tags: [{ start: 17, end: 25, strongs: ['H3068', 'H0430'] }],
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
        [makeVerseId(43, 15, 5)]: {
          text: 'abide, and I in you.',
          tags: [{ start: 0, end: 6, strongs: ['G3306'] }],
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

const once = (verseId: number) => ({ verseId, count: 1 })

const setup = async (
  modules: NormalizedModule[] = [kjv()],
): Promise<{ dataDir: FakeModuleDataDir; concordance: ReturnType<typeof moduleConcordance> }> => {
  const dataDir = new FakeModuleDataDir()
  const store = new ModuleStore(dataDir)
  for (const module of modules) await store.saveModule(module)
  return { dataDir, concordance: moduleConcordance(store) }
}

describe('moduleConcordance', () => {
  it('offers every installed tagged translation to read in', async () => {
    const { concordance } = await setup([web(), kjv()])

    expect(await concordance.translations()).toEqual([
      { id: 'kjv', name: 'King James Version' },
    ])
  })

  it('offers nothing while nothing installed is tagged', async () => {
    const { concordance } = await setup([web()])

    expect(await concordance.translations()).toEqual([])
  })

  it('serves a family\'s counted verses from the index alone', async () => {
    const { dataDir, concordance } = await setup()
    dataDir.reads.length = 0

    const occurrences = await concordance.occurrences('kjv', 'H0430')

    expect(occurrences).toEqual([
      once(makeVerseId(1, 1, 1)),
      once(makeVerseId(1, 1, 4)),
      once(makeVerseId(1, 2, 4)),
    ])
    expect(dataDir.reads).toEqual(['modules/kjv/concordance.json'])
  })

  it('answers an extended number under its family', async () => {
    const { concordance } = await setup()

    expect(await concordance.occurrences('kjv', 'H0430B')).toEqual([
      once(makeVerseId(1, 1, 1)),
      once(makeVerseId(1, 1, 4)),
      once(makeVerseId(1, 2, 4)),
    ])
  })

  it('groups the occurrences by the words the translation renders them with', async () => {
    const { concordance } = await setup()

    expect(await concordance.renderings('kjv', 'H0430')).toEqual([
      {
        text: 'God',
        occurrences: [once(makeVerseId(1, 1, 1)), once(makeVerseId(1, 1, 4))],
      },
      { text: 'LORD God', occurrences: [once(makeVerseId(1, 2, 4))] },
    ])
  })

  it('reads one rendering however the surface is cased or punctuated', async () => {
    const { concordance } = await setup()

    expect(await concordance.renderings('kjv', 'G3306')).toEqual([
      {
        text: 'Abide',
        occurrences: [
          once(makeVerseId(43, 15, 4)),
          once(makeVerseId(43, 15, 5)),
        ],
      },
    ])
  })

  it('groups an extended number\'s renderings under its family', async () => {
    const { concordance } = await setup()

    expect(await concordance.renderings('kjv', 'H0430B')).toEqual([
      {
        text: 'God',
        occurrences: [once(makeVerseId(1, 1, 1)), once(makeVerseId(1, 1, 4))],
      },
      { text: 'LORD God', occurrences: [once(makeVerseId(1, 2, 4))] },
    ])
  })

  it('holds the last family\'s renderings instead of re-reading for them', async () => {
    const { dataDir, concordance } = await setup()
    await concordance.renderings('kjv', 'H0430')
    dataDir.reads.length = 0

    await concordance.renderings('kjv', 'H0430B')

    expect(dataDir.reads).toEqual([])
  })

  it('counts a verse twice for a rendering it tags twice', async () => {
    const { concordance } = await setup([
      {
        manifest: manifest({}),
        books: new Map([
          [
            1,
            {
              [makeVerseId(1, 1, 1)]: {
                text: 'God is God.',
                tags: [
                  { start: 0, end: 3, strongs: ['H0430'] },
                  { start: 7, end: 10, strongs: ['H0430'] },
                ],
              },
            },
          ],
        ]),
      },
    ])

    expect(await concordance.renderings('kjv', 'H0430')).toEqual([
      { text: 'God', occurrences: [{ verseId: makeVerseId(1, 1, 1), count: 2 }] },
    ])
  })

  it('splits a verse that renders the family two ways between them', async () => {
    const { concordance } = await setup([
      {
        manifest: manifest({}),
        books: new Map([
          [
            1,
            {
              [makeVerseId(1, 1, 1)]: {
                text: 'God is the LORD God.',
                tags: [
                  { start: 0, end: 3, strongs: ['H0430'] },
                  { start: 11, end: 19, strongs: ['H0430'] },
                ],
              },
            },
          ],
        ]),
      },
    ])

    expect(await concordance.renderings('kjv', 'H0430')).toEqual([
      { text: 'God', occurrences: [once(makeVerseId(1, 1, 1))] },
      { text: 'LORD God', occurrences: [once(makeVerseId(1, 1, 1))] },
    ])
  })

  it('renders the asked-for verses with the tagged words emphasized', async () => {
    const { concordance } = await setup()

    const verses = await concordance.versesFor('kjv', 'H0430', [
      once(makeVerseId(1, 1, 1)),
      once(makeVerseId(1, 1, 4)),
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
      once(makeVerseId(1, 1, 1)),
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
      once(makeVerseId(1, 1, 1)),
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
      once(makeVerseId(1, 1, 1)),
      once(makeVerseId(1, 1, 4)),
    ])

    expect(dataDir.reads).toEqual(['modules/kjv/001.json'])
  })

  it('leaves out a verse the translation has no content for', async () => {
    const { concordance } = await setup()

    expect(
      await concordance.versesFor('kjv', 'H0430', [once(makeVerseId(1, 9, 9))]),
    ).toEqual([])
  })
})
