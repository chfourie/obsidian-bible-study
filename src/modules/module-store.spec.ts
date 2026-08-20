import { describe, expect, it } from 'vitest'
import { InMemoryModuleDataDir } from '../../tests/fixtures/in-memory-module-data-dir'
import { makeVerseId } from '../reference'
import { CONCORDANCE_INDEX_VERSION } from './concordance-index'
import type { ModuleManifest } from './module-manifest'
import { ModuleStore } from './module-store'
import type { NormalizedModule } from './normalized-module'

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
  const dataDir = new InMemoryModuleDataDir()
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

  it('serves a whole book keyed by verse id', async () => {
    const { store } = setup()
    await store.saveModule(webModule())

    expect(await store.bookContent('web', 43)).toEqual({
      [makeVerseId(43, 15, 4)]: 'Remain in me, and I in you.',
      [makeVerseId(43, 15, 5)]: 'I am the vine. You are the branches.',
    })
  })

  it('treats missing or corrupt book files as an absent book', async () => {
    const { dataDir, store } = setup()
    await store.saveModule(webModule())
    dataDir.files.set('modules/web/064.json', 'not json')

    expect(await store.bookContent('web', 1)).toBeNull()
    expect(await store.bookContent('web', 64)).toBeNull()
    expect(await store.bookContent('kjv', 43)).toBeNull()
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

  it('persists a book module\'s epigraphs beside its content', async () => {
    const { store } = setup()
    const humility: NormalizedModule = {
      ...webModule(),
      manifest: { ...webManifest(), id: 'hum-m1895' },
      epigraphs: {
        1: [{ quote: 'They shall cast their crowns.', attribution: 'Rev. iv. 11' }],
      },
    }

    await store.saveModule(humility)

    expect(await store.epigraphs('hum-m1895')).toEqual({
      1: [{ quote: 'They shall cast their crowns.', attribution: 'Rev. iv. 11' }],
    })
  })

  it('treats a module without an epigraph file as having none', async () => {
    const { store } = setup()
    await store.saveModule(webModule())

    expect(await store.epigraphs('web')).toEqual({})
    expect(await store.epigraphs('kjv')).toEqual({})
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

  it('has no search index for a module that has never been indexed', async () => {
    const { store } = setup()
    await store.saveModule(webModule())

    expect(await store.readSearchIndex('web')).toBeNull()
  })

  it('keeps a module’s search index beside its content', async () => {
    const { store } = setup()
    await store.saveModule(webModule())

    await store.writeSearchIndex('web', '{"terms":[]}')

    expect(await store.readSearchIndex('web')).toBe('{"terms":[]}')
  })

  it('drops the search index with the module it belongs to', async () => {
    const { store } = setup()
    await store.saveModule(webModule())
    await store.writeSearchIndex('web', '{"terms":[]}')

    await store.deleteModule('web')

    expect(await store.readSearchIndex('web')).toBeNull()
  })

  it('drops the search index when the module is saved again', async () => {
    const { store } = setup()
    await store.saveModule(webModule())
    await store.writeSearchIndex('web', '{"terms":[]}')

    await store.saveModule(webModule())

    expect(await store.readSearchIndex('web')).toBeNull()
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

  it('treats a corrupt manifest as absent', async () => {
    const { dataDir, store } = setup()
    await store.saveModule(webModule())
    dataDir.files.set('modules/web/manifest.json', '{"id": "we')

    expect(await store.manifest('web')).toBeNull()
  })

  it('treats verses in a corrupt book file as absent', async () => {
    const { dataDir, store } = setup()
    await store.saveModule(webModule())
    dataDir.files.set('modules/web/043.json', 'not json')

    expect(await store.verseText('web', makeVerseId(43, 15, 4))).toBeNull()
  })

  it('skips modules with corrupt manifests when listing, keeping the rest', async () => {
    const { dataDir, store } = setup()
    await store.saveModule(webModule())
    const kjv = webModule()
    kjv.manifest.id = 'kjv'
    await store.saveModule(kjv)
    dataDir.files.set('modules/kjv/manifest.json', '{"id": "kj')

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

  it('serves plain verse text from a Strong-tagged verse', async () => {
    const { store } = setup()
    const bsb = webModule()
    bsb.manifest.id = 'bsb'
    bsb.books.set(43, {
      [makeVerseId(43, 15, 4)]: {
        text: 'Remain in Me, and I will remain in you.',
        tags: [{ start: 0, end: 6, strongs: ['G3306'] }],
      },
    })

    await store.saveModule(bsb)

    expect(await store.verseText('bsb', makeVerseId(43, 15, 4))).toBe(
      'Remain in Me, and I will remain in you.',
    )
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

const taggedModule = (): NormalizedModule => ({
  manifest: {
    ...webManifest(),
    id: 'kjv',
    name: 'King James Version',
    capabilities: { strongsTagged: true },
  },
  books: new Map([
    [
      1,
      {
        [makeVerseId(1, 1, 1)]: {
          text: 'In the beginning God created the heaven and the earth.',
          tags: [
            { start: 18, end: 21, strongs: ['H0430'] },
            { start: 22, end: 29, strongs: ['H1254', 'H0853'] },
          ],
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

describe("ModuleStore's concordance", () => {
  it('serves the verses a family is tagged in, in canon order, counted', async () => {
    const { store } = setup()
    await store.saveModule(taggedModule())

    expect(await store.occurrences('kjv', 'H0430')).toEqual([
      { verseId: makeVerseId(1, 1, 1), count: 1 },
    ])
    expect(await store.occurrences('kjv', 'G3306')).toEqual([
      { verseId: makeVerseId(43, 15, 4), count: 1 },
    ])
  })

  it('counts a verse tagging the family twice as two occurrences', async () => {
    const { store } = setup()
    const kjv = taggedModule()
    kjv.books.set(1, {
      [makeVerseId(1, 1, 1)]: {
        text: 'God created, and God saw.',
        tags: [
          { start: 0, end: 3, strongs: ['H0430'] },
          { start: 17, end: 20, strongs: ['H0430'] },
        ],
      },
    })

    await store.saveModule(kjv)

    expect(await store.occurrences('kjv', 'H0430')).toEqual([
      { verseId: makeVerseId(1, 1, 1), count: 2 },
    ])
  })

  it('answers an extended number under its family', async () => {
    const { store } = setup()
    const kjv = taggedModule()
    kjv.books.set(1, {
      [makeVerseId(1, 1, 1)]: {
        text: 'In the beginning God created the heaven and the earth.',
        tags: [{ start: 18, end: 21, strongs: ['H0430G'] }],
      },
    })

    await store.saveModule(kjv)

    expect(await store.occurrences('kjv', 'H0430')).toEqual([
      { verseId: makeVerseId(1, 1, 1), count: 1 },
    ])
    expect(await store.occurrences('kjv', 'H0430H')).toEqual([
      { verseId: makeVerseId(1, 1, 1), count: 1 },
    ])
  })

  it('indexes a tagged module that arrives without an index of its own', async () => {
    const { dataDir, store } = setup()

    await store.saveModule(taggedModule())

    expect(dataDir.files.has('modules/kjv/concordance.json')).toBe(true)
    expect(await store.concordanceVersion('kjv')).toBe(
      CONCORDANCE_INDEX_VERSION,
    )
  })

  it('keeps the index a module arrives with instead of deriving another', async () => {
    const { store } = setup()
    const kjv = taggedModule()
    kjv.concordance = { H9999: [makeVerseId(1, 1, 1)] }

    await store.saveModule(kjv)

    expect(await store.occurrences('kjv', 'H9999')).toEqual([
      { verseId: makeVerseId(1, 1, 1), count: 1 },
    ])
    expect(await store.occurrences('kjv', 'H0430')).toEqual([])
  })

  it('leaves an untagged module without a concordance at all', async () => {
    const { dataDir, store } = setup()

    await store.saveModule(webModule())

    expect(dataDir.files.has('modules/web/concordance.json')).toBe(false)
    expect(await store.concordanceVersion('web')).toBe(0)
    expect(await store.occurrences('web', 'G3306')).toEqual([])
  })

  it('serves an index written after the install, past the one read before it', async () => {
    const { store } = setup()
    const kjv = taggedModule()
    kjv.concordance = {}
    await store.saveModule(kjv)
    expect(await store.occurrences('kjv', 'H0430')).toEqual([])

    await store.saveConcordance('kjv', { H0430: [makeVerseId(1, 1, 1)] })

    expect(await store.occurrences('kjv', 'H0430')).toEqual([
      { verseId: makeVerseId(1, 1, 1), count: 1 },
    ])
  })

  it('treats a corrupt concordance as no occurrences anywhere', async () => {
    const { dataDir, store } = setup()
    await store.saveModule(taggedModule())
    dataDir.files.set('modules/kjv/concordance.json', 'not json')

    expect(await store.occurrences('kjv', 'H0430')).toEqual([])
  })

  it('serves an index stored before occurrences were counted, as one each', async () => {
    const { dataDir, store } = setup()
    await store.saveModule(taggedModule())
    dataDir.files.set(
      'modules/kjv/concordance.json',
      JSON.stringify({ H0430: [makeVerseId(1, 1, 1)] }),
    )

    expect(await store.concordanceVersion('kjv')).toBe(0)
    expect(await store.occurrences('kjv', 'H0430')).toEqual([
      { verseId: makeVerseId(1, 1, 1), count: 1 },
    ])
  })
})
