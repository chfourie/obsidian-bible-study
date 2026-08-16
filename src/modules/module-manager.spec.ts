import { describe, expect, it } from 'vitest'
import { SettingsStore } from '../data-access'
import { makeVerseId } from '../reference'
import type { ModuleDataDir } from './module-data-dir'
import { ChecksumMismatchError, ModuleManager } from './module-manager'
import { ModuleStore } from './module-store'
import type { NormalizedModule } from './normalized-module'
import type {
  PrebuiltModuleDownload,
  PrebuiltModuleSource,
} from './prebuilt-module-source'
import type { TranslationSource } from './translation-source'

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

class FakePrebuiltSource implements PrebuiltModuleSource {
  download: PrebuiltModuleDownload = {
    module: bsbModule(),
    checksum: 'sha-bsb-1',
  }
  published: string | null = 'sha-bsb-1'

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
  const manager = new ModuleManager(source, store, settingsStore, {
    bsb: prebuilt,
  })
  return { source, store, settingsStore, prebuilt, manager }
}

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
