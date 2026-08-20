import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SettingsStore } from '../data-access'
import {
  MODULE_FORMAT_VERSION,
  type ModuleDataDir,
  type ModuleManifest,
} from '../modules'
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

const hebrewDerivations = readFileSync(
  'tests/fixtures/strongs-hebrew-slice.xml',
  'utf8',
)
const greekDerivations = readFileSync(
  'tests/fixtures/strongs-greek-slice.xml',
  'utf8',
)

const fakeSource: LexiconSource = {
  fetchHebrew: async () => hebrewSlice,
  fetchGreek: async () => greekSlice,
  fetchHebrewDerivations: async () => hebrewDerivations,
  fetchGreekDerivations: async () => greekDerivations,
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
    ) as ModuleManifest
    expect(manifest.id).toBe(STRONGS_DICTIONARIES_ID)
    expect(manifest.kind).toBe('strongs-dictionaries')
    expect(manifest.license).toContain('CC BY 4.0')
  })
})

describe('StrongsDictionaries format bump', () => {
  it('rebuilds an install left behind by an older module format', async () => {
    const { dataDir, dictionaries } = setup()
    await dictionaries.install()
    await dataDir.writeTextFile(
      'modules/strongs-dictionaries/manifest.json',
      JSON.stringify({ formatVersion: MODULE_FORMAT_VERSION - 1 }),
    )
    await dataDir.writeTextFile('modules/strongs-dictionaries/hebrew.json', '{}')

    await dictionaries.rebuildIfOutdated()

    expect((await dictionaries.entriesFor(['H0001']))[0].gloss).toBe('father')
  })

  it('leaves a current install alone', async () => {
    const { dataDir, dictionaries } = setup()
    await dictionaries.install()
    const written = dataDir.files.get('modules/strongs-dictionaries/hebrew.json')

    await dictionaries.rebuildIfOutdated()

    expect(dataDir.files.get('modules/strongs-dictionaries/hebrew.json')).toBe(
      written,
    )
  })

  it('has nothing to rebuild when the module was never installed', async () => {
    const { dataDir, dictionaries } = setup()

    await dictionaries.rebuildIfOutdated()

    expect(dataDir.files.size).toBe(0)
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

  it('serves the kept columns beside the definition', async () => {
    const { dictionaries } = setup()
    await dictionaries.install()

    const [entry] = await dictionaries.entriesFor(['H0002'])

    expect(entry).toMatchObject({
      strongs: 'H0002',
      variant: 'H0002',
      morphology: 'A:N-M',
    })
  })

  it('answers a tagged translation asking by family with the first sub-entry', async () => {
    const { dictionaries } = setup()
    await dictionaries.install()

    const [entry] = await dictionaries.entriesFor(['H0001'])

    expect(entry).toMatchObject({ strongs: 'H0001', variant: 'H0001G' })
  })

  it('answers an extended number with the sub-entry it names', async () => {
    const { dictionaries } = setup()
    await dictionaries.install()

    const [entry] = await dictionaries.entriesFor(['H0001I'])

    expect(entry).toMatchObject({ variant: 'H0001I', gloss: 'father of' })
  })
})

describe('StrongsDictionaries word study', () => {
  it('names the siblings an extended number shares its family with', async () => {
    const { dictionaries } = setup()
    await dictionaries.install()

    const study = await dictionaries.studyEntryFor('H0001H')

    expect(study?.entry.variant).toBe('H0001H')
    expect(study?.siblings).toEqual(['H0001G', 'H0001I'])
  })

  it('leaves a lone entry without siblings', async () => {
    const { dictionaries } = setup()
    await dictionaries.install()

    expect((await dictionaries.studyEntryFor('H0002'))?.siblings).toEqual([])
  })

  it("carries the Strong's 1890 derivation of the family it belongs to", async () => {
    const { dictionaries } = setup()
    await dictionaries.install()

    expect((await dictionaries.studyEntryFor('H0001G'))?.derivation).toBe(
      'a primitive word;',
    )
    expect((await dictionaries.studyEntryFor('H0002'))?.derivation).toBe(
      '(Aramaic) corresponding to H0001',
    )
  })

  it('carries derivations for Greek as well as Hebrew', async () => {
    const { dictionaries } = setup()
    await dictionaries.install()

    expect((await dictionaries.studyEntryFor('G0004'))?.derivation).toBe(
      'from G0001 (as a negative particle) and G0922;',
    )
  })

  it('leaves the derivation empty where the 1890 dictionary states none', async () => {
    const { dictionaries } = setup()
    await dictionaries.install()

    expect((await dictionaries.studyEntryFor('G0003'))?.derivation).toBe(null)
  })

  it('has nothing to study for a number no entry covers', async () => {
    const { dictionaries } = setup()
    await dictionaries.install()

    expect(await dictionaries.studyEntryFor('H9999')).toBe(null)
  })

  it('names the family of a number no entry answers to', async () => {
    const { dictionaries } = setup()
    await dictionaries.install()

    expect(await dictionaries.familySiblingsOf('H0001Z')).toEqual([
      'H0001G',
      'H0001H',
      'H0001I',
    ])
  })

  it('knows no family for a number outside the dictionaries', async () => {
    const { dictionaries } = setup()
    await dictionaries.install()

    expect(await dictionaries.familySiblingsOf('H9999')).toEqual([])
    expect(await dictionaries.familySiblingsOf('X1')).toEqual([])
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
