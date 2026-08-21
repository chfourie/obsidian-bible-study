import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsStore } from '../data-access'
import { InMemoryModuleDataDir } from '../../tests/fixtures/in-memory-module-data-dir'
import {
  chapterCount,
  deregisterBook,
  deregisterBookVersification,
  isValidVerseId,
  makeVerseId,
  registeredBooks,
} from '../reference'
import { ChecksumMismatchError, ModuleManager } from './module-manager'
import { ModuleStore } from './module-store'
import type { NormalizedModule } from './normalized-module'
import type {
  PrebuiltModuleDownload,
  PrebuiltModuleSource,
} from './prebuilt-module-source'
import type { TranslationSource } from './translation-source'

const webModule = (): NormalizedModule => ({
  manifest: {
    id: 'web',
    name: 'World English Bible',
    language: 'English',
    license: '',
    source: 'https://bolls.life/static/translations/WEB.json',
    sourceChecksum: 'sha-web-1',
    formatVersion: 1,
    capabilities: { strongsTagged: false },
  },
  books: new Map([
    [43, { [makeVerseId(43, 15, 4)]: 'Remain in me, and I in you.' }],
  ]),
})

class FakeTranslationSource implements TranslationSource {
  modules: Record<string, NormalizedModule> = { web: webModule() }
  requestedIds: string[] = []

  async fetchModule(moduleId: string): Promise<NormalizedModule> {
    this.requestedIds.push(moduleId)
    const module = this.modules[moduleId]
    if (!module) throw new Error(`unknown translation ${moduleId}`)
    return module
  }
}

const bsbModule = (): NormalizedModule => ({
  manifest: {
    id: 'bsb',
    name: 'Berean Standard Bible',
    language: 'English',
    license: 'Public Domain',
    source: 'https://example.com/bsb-module.json',
    sourceChecksum: 'sha-bsb-1',
    formatVersion: 1,
    capabilities: { strongsTagged: true },
  },
  books: new Map([
    [
      43,
      {
        [makeVerseId(43, 15, 4)]: {
          text: 'Remain in Me, and I in you.',
          tags: [{ start: 0, end: 6, strongs: ['G3306'] }],
        },
      },
    ],
  ]),
})

const HUMILITY_BOOK = 101

const humilityModule = (): NormalizedModule => ({
  manifest: {
    id: 'hum-m1895',
    name: 'Humility',
    language: 'English',
    license: 'Public Domain',
    source: 'https://example.com/hum-m1895-module.json',
    sourceChecksum: 'sha-hum-1',
    formatVersion: 2,
    kind: 'book',
    capabilities: { strongsTagged: false },
    book: {
      number: HUMILITY_BOOK,
      editionCode: 'HUM-M1895',
      author: 'Andrew Murray',
      year: 1895,
      abbreviation: 'Hum',
      sections: [
        { chapter: 0, name: 'Preface', paragraphs: 4 },
        { chapter: 1, name: 'The Glory of the Creature', paragraphs: 9 },
      ],
    },
  },
  books: new Map([
    [
      HUMILITY_BOOK,
      { [makeVerseId(HUMILITY_BOOK, 0, 1)]: { text: 'In the Preface.' } },
    ],
  ]),
})

class FakePrebuiltSource implements PrebuiltModuleSource {
  download: PrebuiltModuleDownload
  published: string | null

  constructor(module: NormalizedModule = bsbModule()) {
    this.download = { module, checksum: module.manifest.sourceChecksum }
    this.published = module.manifest.sourceChecksum
  }

  async fetchModule(): Promise<PrebuiltModuleDownload> {
    return this.download
  }

  async fetchChecksum(): Promise<string | null> {
    return this.published
  }
}

const inMemorySettingsStore = () => {
  let data: unknown = null
  return new SettingsStore({
    loadData: async () => data,
    saveData: async (value) => {
      data = value
    },
  })
}

const setup = () => {
  const source = new FakeTranslationSource()
  const store = new ModuleStore(new InMemoryModuleDataDir())
  const settingsStore = inMemorySettingsStore()
  const prebuilt = new FakePrebuiltSource()
  const humility = new FakePrebuiltSource(humilityModule())
  const modulesChanged = vi.fn()
  const manager = new ModuleManager(
    source,
    store,
    settingsStore,
    { bsb: prebuilt, 'hum-m1895': humility },
    modulesChanged,
  )
  return {
    source,
    store,
    settingsStore,
    prebuilt,
    humility,
    modulesChanged,
    manager,
  }
}

afterEach(() => {
  deregisterBookVersification(HUMILITY_BOOK)
  deregisterBook(HUMILITY_BOOK)
})

describe('ModuleManager download', () => {
  it('installs the module the source serves for the requested id', async () => {
    const { source, store, manager } = setup()

    const manifest = await manager.downloadModule('web')

    expect(source.requestedIds).toEqual(['web'])
    expect(manifest).toEqual(webModule().manifest)
    expect(await store.manifest('web')).toEqual(manifest)
    expect(await store.verseText('web', makeVerseId(43, 15, 4))).toBe(
      'Remain in me, and I in you.',
    )
  })

  it('propagates a failed download without saving or recording anything', async () => {
    const { store, settingsStore, manager } = setup()

    await expect(manager.downloadModule('nope')).rejects.toThrow(
      'unknown translation nope',
    )
    expect(await store.manifest('nope')).toBeNull()
    expect((await settingsStore.loadSettings()).installedModuleIds).toEqual([])
  })
})

describe('ModuleManager prebuilt modules', () => {
  it('installs a prebuilt tagged module and records its id', async () => {
    const { store, settingsStore, manager } = setup()

    const manifest = await manager.downloadModule('bsb')

    expect(manifest.capabilities.strongsTagged).toBe(true)
    expect(await store.verseText('bsb', makeVerseId(43, 15, 4))).toBe(
      'Remain in Me, and I in you.',
    )
    expect((await settingsStore.loadSettings()).installedModuleIds).toEqual([
      'bsb',
    ])
  })

  it('rejects a prebuilt download whose bytes do not match the published checksum', async () => {
    const { store, prebuilt, manager } = setup()
    prebuilt.published = 'sha-bsb-2'

    await expect(manager.downloadModule('bsb')).rejects.toBeInstanceOf(
      ChecksumMismatchError,
    )
    expect(await store.manifest('bsb')).toBeNull()
  })

  it('installs a prebuilt module when no published checksum exists', async () => {
    const { prebuilt, manager } = setup()
    prebuilt.published = null

    const manifest = await manager.downloadModule('bsb')

    expect(manifest.id).toBe('bsb')
  })
})

describe('ModuleManager installed-module ids in settings', () => {
  it('records the module id on install', async () => {
    const { settingsStore, manager } = setup()

    await manager.downloadModule('web')

    expect((await settingsStore.loadSettings()).installedModuleIds).toEqual([
      'web',
    ])
  })

  it('does not duplicate the id when re-downloading an installed module', async () => {
    const { settingsStore, manager } = setup()
    await manager.downloadModule('web')

    await manager.downloadModule('web')

    expect((await settingsStore.loadSettings()).installedModuleIds).toEqual([
      'web',
    ])
  })

  it('removes the module and its id on delete, keeping other ids', async () => {
    const { store, settingsStore, manager } = setup()
    await settingsStore.updateSettings((settings) => ({
      ...settings,
      installedModuleIds: ['bsb'],
    }))
    await manager.downloadModule('web')

    await manager.deleteModule('web')

    expect(await store.manifest('web')).toBeNull()
    expect((await settingsStore.loadSettings()).installedModuleIds).toEqual([
      'bsb',
    ])
  })
})

describe('ModuleManager book modules', () => {
  it('installs a book module into the unchanged storage layout', async () => {
    const { store, settingsStore, manager } = setup()

    const manifest = await manager.downloadModule('hum-m1895')

    expect(manifest.kind).toBe('book')
    expect(await store.manifest('hum-m1895')).toEqual(manifest)
    expect(
      await store.verseText('hum-m1895', makeVerseId(HUMILITY_BOOK, 0, 1)),
    ).toBe('In the Preface.')
    expect((await settingsStore.loadSettings()).installedModuleIds).toEqual([
      'hum-m1895',
    ])
  })

  it('registers the book versification table on install', async () => {
    const { manager } = setup()

    await manager.downloadModule('hum-m1895')

    expect(chapterCount(HUMILITY_BOOK)).toBe(2)
    expect(isValidVerseId(makeVerseId(HUMILITY_BOOK, 1, 9))).toBe(true)
  })

  // Everything that lists the installed Books — the Search Scope picker
  // above all — reads the registry the moment the settings write announces
  // the install. A book registered after that announcement is missing from
  // the picker until the next plugin load.
  it('registers the book before the install is announced', async () => {
    const { settingsStore, manager } = setup()
    const announced: number[][] = []
    settingsStore.onSettingsChanged(() =>
      announced.push(registeredBooks().map((book) => book.id)),
    )

    await manager.downloadModule('hum-m1895')

    expect(announced[announced.length - 1]).toEqual([HUMILITY_BOOK])
  })

  it('deregisters the book versification table on uninstall', async () => {
    const { manager } = setup()
    await manager.downloadModule('hum-m1895')

    await manager.deleteModule('hum-m1895')

    expect(chapterCount(HUMILITY_BOOK)).toBe(0)
    expect(isValidVerseId(makeVerseId(HUMILITY_BOOK, 1, 9))).toBe(false)
  })

  it('leaves the registry alone when a rejected download never lands', async () => {
    const { humility, manager } = setup()
    humility.published = 'sha-hum-2'

    await expect(manager.downloadModule('hum-m1895')).rejects.toBeInstanceOf(
      ChecksumMismatchError,
    )
    expect(chapterCount(HUMILITY_BOOK)).toBe(0)
  })

  it('reports an installed book update when its published checksum changes', async () => {
    const { humility, manager } = setup()
    await manager.downloadModule('hum-m1895')

    humility.published = 'sha-hum-2'

    expect(await manager.modulesWithUpdates()).toEqual(['hum-m1895'])
  })
})

describe('ModuleManager change notifications', () => {
  it('announces install and uninstall so the vault reindexes', async () => {
    const { modulesChanged, manager } = setup()

    await manager.downloadModule('hum-m1895')
    await manager.deleteModule('hum-m1895')

    expect(modulesChanged).toHaveBeenCalledTimes(2)
  })

  it('stays silent when a download fails', async () => {
    const { modulesChanged, manager } = setup()

    await expect(manager.downloadModule('nope')).rejects.toThrow()

    expect(modulesChanged).not.toHaveBeenCalled()
  })
})

describe('ModuleManager update detection', () => {
  it('reports a prebuilt module update when its published checksum changes', async () => {
    const { prebuilt, manager } = setup()
    await manager.downloadModule('bsb')

    prebuilt.published = 'sha-bsb-2'

    expect(await manager.modulesWithUpdates()).toEqual(['bsb'])
  })

  it('reports no prebuilt update when checksums still match', async () => {
    const { manager } = setup()
    await manager.downloadModule('bsb')

    expect(await manager.modulesWithUpdates()).toEqual([])
  })

  it('never reports catalogue modules — bolls publishes no checksums, update = re-download', async () => {
    const { manager } = setup()
    await manager.downloadModule('web')

    expect(await manager.modulesWithUpdates()).toEqual([])
  })
})

describe('ModuleManager search index', () => {
  it('builds the module’s index when an install completes', async () => {
    const { manager } = setup()
    const indexed: string[] = []
    manager.useIndexer(async (moduleId) => {
      indexed.push(moduleId)
    })

    await manager.downloadModule('web')

    expect(indexed).toEqual(['web'])
  })

  it('indexes a prebuilt Book against the content just saved', async () => {
    const { store, manager } = setup()
    const seen: (string | null)[] = []
    manager.useIndexer(async (moduleId) => {
      seen.push((await store.manifest(moduleId))?.sourceChecksum ?? null)
    })

    await manager.downloadModule('hum-m1895')

    expect(seen).toEqual(['sha-hum-1'])
  })

  it('rebuilds the index on every re-download', async () => {
    const { manager } = setup()
    const indexed: string[] = []
    manager.useIndexer(async (moduleId) => {
      indexed.push(moduleId)
    })

    await manager.downloadModule('web')
    await manager.downloadModule('web')

    expect(indexed).toEqual(['web', 'web'])
  })

  it('installs the module even when its index build fails', async () => {
    const { store, settingsStore, manager } = setup()
    manager.useIndexer(async () => {
      throw new Error('index build failed')
    })

    await expect(manager.downloadModule('web')).resolves.toBeDefined()

    expect(await store.manifest('web')).not.toBeNull()
    expect((await settingsStore.loadSettings()).installedModuleIds).toEqual([
      'web',
    ])
  })

  it('indexes nothing when the download never lands', async () => {
    const { manager } = setup()
    const indexed: string[] = []
    manager.useIndexer(async (moduleId) => {
      indexed.push(moduleId)
    })

    await expect(manager.downloadModule('nope')).rejects.toThrow()

    expect(indexed).toEqual([])
  })

  it('leaves no index behind when the module is uninstalled', async () => {
    const { store, manager } = setup()
    await manager.downloadModule('web')
    await store.writeSearchIndex('web', '{"terms":[],"verseIds":[]}')

    await manager.deleteModule('web')

    expect(await store.readSearchIndex('web')).toBeNull()
  })

  it('leaves no stale index behind when the module is downloaded over', async () => {
    const { store, manager } = setup()
    await manager.downloadModule('web')
    await store.writeSearchIndex('web', '{"terms":[],"verseIds":[]}')
    manager.useIndexer(async () => {})

    await manager.downloadModule('web')

    expect(await store.readSearchIndex('web')).toBeNull()
  })
})
