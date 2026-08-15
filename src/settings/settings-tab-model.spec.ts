import { describe, expect, it, vi } from 'vitest'
import { SettingsStore, type BibleStudySettings } from '../data-access'
import type { ModuleManifest } from '../modules'
import { SettingsTabModel, type SettingsTabDeps } from './settings-tab-model'

const manifest = (id: string, name = id.toUpperCase(), tagged = false): ModuleManifest => ({
  id,
  name,
  language: 'English',
  license: 'Public Domain',
  source: 'test',
  sourceChecksum: '',
  formatVersion: 1,
  capabilities: { strongsTagged: tagged },
})

type SetupOverrides = Partial<SettingsTabDeps> & {
  storedSettings?: Partial<BibleStudySettings>
}

const setup = (overrides: SetupOverrides = {}) => {
  const { storedSettings, ...deps } = overrides
  let data: unknown = storedSettings ?? null
  const settingsStore = new SettingsStore({
    loadData: async () => data,
    saveData: async (value) => {
      data = value
    },
  })
  const model = new SettingsTabModel({
    settingsStore,
    installedManifests: async () => [],
    availableTranslations: async () => [],
    onlineTranslations: [
      { id: 'nkjv', apiBibleId: 'nkjv-api-id', name: 'New King James Version' },
    ],
    downloadModule: vi.fn(async () => {}),
    deleteModule: vi.fn(async () => {}),
    modulesWithUpdates: async () => [],
    clearPassageCache: vi.fn(async () => {}),
    strongs: {
      isInstalled: async () => false,
      install: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    },
    ...deps,
  })
  return { model, settingsStore }
}

describe('SettingsTabModel general section', () => {
  it('offers installed modules plus enabled online translations as default options', async () => {
    const { model } = setup({
      storedSettings: {
        installedModuleIds: ['web', 'strongs-dictionaries'],
        apiBibleKey: 'key-123',
        enabledOnlineTranslationIds: ['nkjv'],
      },
      installedManifests: async () => [
        manifest('web', 'World English Bible'),
        manifest('strongs-dictionaries'),
      ],
    })

    await model.refresh()

    expect(model.view.defaultTranslationOptions).toEqual([
      { id: 'web', label: 'World English Bible' },
      { id: 'nkjv', label: 'New King James Version' },
    ])
  })

  it('restricts fallback options to installed offline modules', async () => {
    const { model } = setup({
      storedSettings: {
        installedModuleIds: ['web'],
        apiBibleKey: 'key-123',
        enabledOnlineTranslationIds: ['nkjv'],
      },
      installedManifests: async () => [manifest('web', 'World English Bible')],
    })

    await model.refresh()

    expect(model.view.fallbackTranslationOptions).toEqual([
      { id: 'web', label: 'World English Bible' },
    ])
  })

  it('flags the empty state so pickers render a disabled placeholder', async () => {
    const { model } = setup()

    await model.refresh()

    expect(model.view.noTranslationsAvailable).toBe(true)
  })
})
