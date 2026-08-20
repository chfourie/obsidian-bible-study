import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SettingsStore } from '../data-access'
import type { ModuleDataDir, ModuleManifest } from '../modules'
import { LSJ_LEXICON_ID, LsjLexicon } from './lsj-lexicon'
import type { LsjSource } from './lsj-source'

const slice = readFileSync('tests/fixtures/tflsj-slice.txt', 'utf8')

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

  async listDirs(): Promise<string[]> {
    return []
  }
}

const fakeSource = (parts: string[] = [slice]): LsjSource => ({
  fetchLsj: async () => parts,
})

const inMemorySettingsStore = () => {
  let data: unknown = null
  return new SettingsStore({
    loadData: async () => data,
    saveData: async (value) => {
      data = value
    },
  })
}

const setup = (source: LsjSource = fakeSource()) => {
  const dataDir = new InMemoryModuleDataDir()
  const settingsStore = inMemorySettingsStore()
  const lsj = new LsjLexicon(dataDir, source, settingsStore)
  return { dataDir, settingsStore, lsj }
}

describe('LsjLexicon install', () => {
  it('is not installed before any download', async () => {
    const { lsj } = setup()

    expect(await lsj.isInstalled()).toBe(false)
  })

  it('records the module id in settings once installed', async () => {
    const { settingsStore, lsj } = setup()

    await lsj.install()

    expect(await lsj.isInstalled()).toBe(true)
    expect((await settingsStore.loadSettings()).installedModuleIds).toContain(
      LSJ_LEXICON_ID,
    )
  })

  it('writes a manifest naming its own kind and licence', async () => {
    const { dataDir, lsj } = setup()

    await lsj.install()

    const manifest = JSON.parse(
      dataDir.files.get('modules/lsj-lexicon/manifest.json') ?? 'null',
    ) as ModuleManifest
    expect(manifest.id).toBe(LSJ_LEXICON_ID)
    expect(manifest.kind).toBe('lsj-lexicon')
    expect(manifest.license).toContain('CC BY 4.0')
  })

  it('merges every part the lexicon is published in', async () => {
    const extra = 'G6000\tG6000 =\t\t\t\t\t\tto report'
    const { lsj } = setup(fakeSource([slice, extra]))

    await lsj.install()

    expect(await lsj.entryFor('G0035')).toContain('of unrecorded descent')
    expect(await lsj.entryFor('G6000')).toBe('to report')
  })

  it('holds the entries apart so one lookup reads only its own share', async () => {
    const { dataDir, lsj } = setup()

    await lsj.install()

    const stored = [...dataDir.files.keys()].filter(
      (path) => path !== 'modules/lsj-lexicon/manifest.json',
    )
    expect(stored.length).toBeGreaterThan(1)
  })

  it('drops the stored lexicon when the module is removed', async () => {
    const { dataDir, settingsStore, lsj } = setup()
    await lsj.install()

    await lsj.remove()

    expect(await lsj.isInstalled()).toBe(false)
    expect(dataDir.files.size).toBe(0)
    expect(
      (await settingsStore.loadSettings()).installedModuleIds,
    ).not.toContain(LSJ_LEXICON_ID)
  })
})

describe('LsjLexicon lookup', () => {
  it('serves the full entry of an extended number', async () => {
    const { lsj } = setup()
    await lsj.install()

    expect(await lsj.entryFor('G0001H')).toContain('Epic dialect')
  })

  it('serves a bare family number with its first sub-entry', async () => {
    const { lsj } = setup()
    await lsj.install()

    expect(await lsj.entryFor('G0223')).toBe(await lsj.entryFor('G0223G'))
  })

  it('answers with nothing for a Greek number the lexicon carries no entry for', async () => {
    const { lsj } = setup()
    await lsj.install()

    expect(await lsj.entryFor('G9999')).toBeNull()
  })

  it('answers with nothing for a Hebrew number, which LSJ never covers', async () => {
    const { lsj } = setup()
    await lsj.install()

    expect(await lsj.entryFor('H0001')).toBeNull()
  })

  it('answers with nothing while the module is not installed', async () => {
    const { lsj } = setup()

    expect(await lsj.entryFor('G0035')).toBeNull()
  })
})
