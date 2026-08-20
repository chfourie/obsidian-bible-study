import { afterEach, describe, expect, it } from 'vitest'
import { SettingsStore } from '../data-access'
import {
  ModuleManager,
  ModuleStore,
  type ModuleDataDir,
  type NormalizedModule,
  type PrebuiltModuleDownload,
  type PrebuiltModuleSource,
  type TranslationSource,
} from '../modules'
import {
  deregisterBookVersification,
  makeVerseId,
  type Reference,
} from '../reference'
import { SearchEngine } from './search-engine'
import { SearchPaneModel, type SearchPaneStatus } from './search-pane-model'
import type { SearchScope, SearchScopeOptions } from './search-scope'

const HUMILITY_BOOK = 101

class InMemoryModuleDataDir implements ModuleDataDir {
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

const webModule = (checksum = 'sha-web-1'): NormalizedModule => ({
  manifest: {
    id: 'web',
    name: 'World English Bible',
    language: 'English',
    license: 'Public Domain',
    source: 'https://bolls.life/static/translations/WEB.json',
    sourceChecksum: checksum,
    formatVersion: 2,
    capabilities: { strongsTagged: false },
  },
  books: new Map([
    [
      43,
      {
        [makeVerseId(43, 15, 1)]: 'I am the true vine.',
        [makeVerseId(43, 15, 5)]: 'I am the vine. You are the branches.',
      },
    ],
  ]),
})

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
      sections: [{ chapter: 1, name: 'The Glory of the Creature', paragraphs: 9 }],
    },
  },
  books: new Map([
    [
      HUMILITY_BOOK,
      {
        [makeVerseId(HUMILITY_BOOK, 1, 2)]: {
          text: 'Humility is the soil of every grace.',
        },
      },
    ],
  ]),
})

class FakeTranslationSource implements TranslationSource {
  module = webModule()

  async fetchModule(): Promise<NormalizedModule> {
    return this.module
  }
}

class FakePrebuiltSource implements PrebuiltModuleSource {
  constructor(private readonly module: NormalizedModule) {}

  async fetchModule(): Promise<PrebuiltModuleDownload> {
    return { module: this.module, checksum: this.module.manifest.sourceChecksum }
  }

  async fetchChecksum(): Promise<string | null> {
    return this.module.manifest.sourceChecksum
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

const SCOPE_OPTIONS: SearchScopeOptions = {
  translations: [{ id: 'web', label: 'WEB' }],
  books: [{ moduleId: 'hum-m1895', bookId: HUMILITY_BOOK, label: 'Humility' }],
  fallbackTranslationId: 'web',
}

const setup = (books: readonly number[] = [43, HUMILITY_BOOK]) => {
  const dataDir = new InMemoryModuleDataDir()
  const store = new ModuleStore(dataDir)
  const source = new FakeTranslationSource()
  const engine = new SearchEngine(store, books)
  const manager = new ModuleManager(source, store, inMemorySettingsStore(), {
    'hum-m1895': new FakePrebuiltSource(humilityModule()),
  })
  manager.useIndexer((moduleId) => engine.indexModule(moduleId))
  const statuses: SearchPaneStatus[] = []
  const scope: SearchScope = {
    translation: { id: 'web', label: 'WEB' },
    testament: 'all',
    books: SCOPE_OPTIONS.books,
    book: null,
  }
  const model = new SearchPaneModel({
    scopeOptions: () => SCOPE_OPTIONS,
    scope: () => scope,
    chooseScope: () => {},
    search: (moduleId, query, onProgress) =>
      engine.search(moduleId, query, onProgress),
    openHit: (reference: Reference) => void reference,
  })
  model.subscribe(() => statuses.push(model.view.status))
  const searchFor = async (query: string) => {
    model.setQuery(query)
    await model.submit()
    return model.view
  }
  return { dataDir, store, source, engine, manager, model, statuses, searchFor }
}

const indexOf = (dataDir: InMemoryModuleDataDir, moduleId: string) =>
  dataDir.files.get(`modules/${moduleId}/search-index.json`) ?? null

const checksumOf = (content: string | null): string | null =>
  content === null
    ? null
    : ((JSON.parse(content) as { sourceChecksum: string }).sourceChecksum ??
      null)

afterEach(() => deregisterBookVersification(HUMILITY_BOOK))

describe('search index at module install', () => {
  it('ends a translation download with its index persisted', async () => {
    const { dataDir, manager } = setup()

    await manager.downloadModule('web')

    expect(checksumOf(indexOf(dataDir, 'web'))).toBe('sha-web-1')
  })

  it('ends a Book download with its index persisted', async () => {
    const { dataDir, manager } = setup()

    await manager.downloadModule('hum-m1895')

    expect(checksumOf(indexOf(dataDir, 'hum-m1895'))).toBe('sha-hum-1')
  })

  it('stamps a re-download’s index with the fresh checksum', async () => {
    const { dataDir, source, manager } = setup()
    await manager.downloadModule('web')

    source.module = webModule('sha-web-2')
    await manager.downloadModule('web')

    expect(checksumOf(indexOf(dataDir, 'web'))).toBe('sha-web-2')
  })

  it('answers the first search after an install without indexing', async () => {
    const { manager, statuses, searchFor } = setup()
    await manager.downloadModule('web')
    statuses.length = 0

    const view = await searchFor('vine')

    expect(view.totalHits).toBe(2)
    expect(statuses).not.toContain('indexing')
    expect(view.indexing).toBeNull()
  })

  it('answers the first search after a Book install without indexing', async () => {
    const { manager, statuses, searchFor } = setup()
    await manager.downloadModule('web')
    await manager.downloadModule('hum-m1895')
    statuses.length = 0

    const view = await searchFor('grace')

    expect(view.totalHits).toBe(1)
    expect(statuses).not.toContain('indexing')
  })

  it('installs the module and falls back to the lazy build when the eager one fails', async () => {
    const { dataDir, store, manager, statuses, searchFor } = setup()
    manager.useIndexer(async () => {
      throw new Error('no room to write the index')
    })

    await manager.downloadModule('web')
    expect(await store.manifest('web')).not.toBeNull()
    expect(indexOf(dataDir, 'web')).toBeNull()

    statuses.length = 0
    const view = await searchFor('vine')

    expect(view.totalHits).toBe(2)
    expect(statuses).toContain('indexing')
    expect(checksumOf(indexOf(dataDir, 'web'))).toBe('sha-web-1')
  })

  it('takes the index with the module when it is uninstalled', async () => {
    const { dataDir, manager } = setup()
    await manager.downloadModule('web')

    await manager.deleteModule('web')

    expect(indexOf(dataDir, 'web')).toBeNull()
  })
})
