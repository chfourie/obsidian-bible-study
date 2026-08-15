import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SettingsStore } from '../data-access'
import type { ModuleDataDir } from '../modules'
import type { LexiconSource } from './lexicon-source'
import { STRONGS_DICTIONARIES_ID, StrongsDictionaries } from './strongs-dictionaries'

const hebrewSlice = readFileSync('tests/fixtures/tbesh-slice.txt', 'utf8')
const greekSlice = readFileSync('tests/fixtures/tbesg-slice.txt', 'utf8')

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

const fakeSource: LexiconSource = {
  fetchHebrew: async () => hebrewSlice,
  fetchGreek: async () => greekSlice,
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
  const dataDir = new InMemoryModuleDataDir()
  const settingsStore = inMemorySettingsStore()
  const dictionaries = new StrongsDictionaries(dataDir, fakeSource, settingsStore)
  return { dataDir, settingsStore, dictionaries }
}

describe('StrongsDictionaries install', () => {
  it('is not installed before any download', async () => {
    const { dictionaries } = setup()

    expect(await dictionaries.isInstalled()).toBe(false)
  })

  it('stores both lexicons and records the module id in settings', async () => {
    const { settingsStore, dictionaries } = setup()

    await dictionaries.install()

    expect(await dictionaries.isInstalled()).toBe(true)
    expect((await settingsStore.loadSettings()).installedModuleIds).toContain(
      STRONGS_DICTIONARIES_ID,
    )
  })

  it('writes a manifest that marks the module as dictionaries, not a translation', async () => {
    const { dataDir, dictionaries } = setup()

    await dictionaries.install()

    const manifest = JSON.parse(
      dataDir.files.get('modules/strongs-dictionaries/manifest.json') ?? 'null',
    )
    expect(manifest).toMatchObject({
      id: STRONGS_DICTIONARIES_ID,
      kind: 'strongs-dictionaries',
      license: expect.stringContaining('CC BY 4.0'),
    })
  })
})

describe('StrongsDictionaries lookup', () => {
  it('serves entries for Hebrew and Greek numbers in the requested order', async () => {
    const { dictionaries } = setup()
    await dictionaries.install()

    const entries = await dictionaries.entriesFor(['G0002', 'H0001'])

    expect(entries.map((entry) => entry.strongs)).toEqual(['G0002', 'H0001'])
    expect(entries[0].gloss).toBe('Aaron')
    expect(entries[1].gloss).toBe('father')
  })

  it('skips numbers without an entry', async () => {
    const { dictionaries } = setup()
    await dictionaries.install()

    const entries = await dictionaries.entriesFor(['H9999', 'H0006'])

    expect(entries.map((entry) => entry.strongs)).toEqual(['H0006'])
  })

  it('serves no entries when the module is not installed', async () => {
    const { dictionaries } = setup()

    expect(await dictionaries.entriesFor(['H0001'])).toEqual([])
  })
})

describe('StrongsDictionaries remove', () => {
  it('deletes the stored module and unrecords its id', async () => {
    const { dataDir, settingsStore, dictionaries } = setup()
    await dictionaries.install()

    await dictionaries.remove()

    expect(await dictionaries.isInstalled()).toBe(false)
    expect(await dictionaries.entriesFor(['H0001'])).toEqual([])
    expect(
      (await settingsStore.loadSettings()).installedModuleIds,
    ).not.toContain(STRONGS_DICTIONARIES_ID)
    expect(dataDir.files.size).toBe(0)
  })
})
