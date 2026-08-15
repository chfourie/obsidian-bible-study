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

describe('SettingsTabModel translation management list', () => {
  it('lists downloadable rows matching the language filter, then online rows when a key is set', async () => {
    const { model } = setup({
      storedSettings: { apiBibleKey: 'key-123' },
      availableTranslations: async () => [
        { id: 'web', name: 'World English Bible', language: 'English' },
        { id: 'aov', name: 'Ou Vertaling', language: 'Afrikaans' },
        { id: 'bsb', name: 'Berean Standard Bible', language: 'English', strongsTagged: true },
      ],
    })

    await model.refresh()

    expect(model.view.rows).toEqual([
      expect.objectContaining({ id: 'web', tier: 'downloadable', installed: false }),
      expect.objectContaining({ id: 'bsb', tier: 'downloadable', strongsTagged: true }),
      expect.objectContaining({
        id: 'nkjv',
        name: 'New King James Version',
        tier: 'online',
        enabled: false,
      }),
    ])
  })

  it('hides online rows without an API key', async () => {
    const { model } = setup({
      availableTranslations: async () => [
        { id: 'web', name: 'World English Bible', language: 'English' },
      ],
    })

    await model.refresh()

    expect(model.view.rows.map((row) => row.tier)).toEqual(['downloadable'])
  })

  it('always lists installed modules even when the catalog omits or filters them', async () => {
    const { model } = setup({
      storedSettings: {
        installedModuleIds: ['aov'],
        languageFilter: 'English',
      },
      installedManifests: async () => [manifest('aov', 'Ou Vertaling')],
      availableTranslations: async () => [
        { id: 'web', name: 'World English Bible', language: 'English' },
        { id: 'aov', name: 'Ou Vertaling', language: 'Afrikaans' },
      ],
    })

    await model.refresh()

    expect(model.view.rows).toEqual([
      expect.objectContaining({ id: 'web', installed: false }),
      expect.objectContaining({ id: 'aov', installed: true }),
    ])
  })

  it('marks installed rows that have updates and carries the Strongs badge from the manifest', async () => {
    const { model } = setup({
      storedSettings: { installedModuleIds: ['bsb'] },
      installedManifests: async () => [
        manifest('bsb', 'Berean Standard Bible', true),
      ],
      availableTranslations: async () => [
        { id: 'bsb', name: 'Berean Standard Bible', language: 'English' },
      ],
      modulesWithUpdates: async () => ['bsb'],
    })

    await model.refresh()

    expect(model.view.rows).toEqual([
      expect.objectContaining({
        id: 'bsb',
        installed: true,
        updateAvailable: true,
        strongsTagged: true,
      }),
    ])
  })

  it('shows download progress on the row until the module lands', async () => {
    let resolveDownload: () => void = () => {}
    const { model } = setup({
      availableTranslations: async () => [
        { id: 'web', name: 'World English Bible', language: 'English' },
      ],
      downloadModule: vi.fn(
        () => new Promise<void>((resolve) => (resolveDownload = resolve)),
      ),
    })
    await model.refresh()

    const download = model.download('web')
    expect(model.view.rows[0].busy).toBe('downloading')

    resolveDownload()
    await download
    expect(model.view.rows[0].busy).toBe(null)
  })

  it('surfaces a failed download on the row and clears the busy state', async () => {
    const { model } = setup({
      availableTranslations: async () => [
        { id: 'web', name: 'World English Bible', language: 'English' },
      ],
      downloadModule: vi.fn(async () => {
        throw new Error('network gone')
      }),
    })
    await model.refresh()

    await model.download('web')

    expect(model.view.rows[0].busy).toBe(null)
    expect(model.view.rows[0].error).toBe('network gone')
  })

  it('reflects the fresh settings and manifests after a download', async () => {
    let installed = false
    const { model, settingsStore } = setup({
      availableTranslations: async () => [
        { id: 'web', name: 'World English Bible', language: 'English' },
      ],
      installedManifests: async () =>
        installed ? [manifest('web', 'World English Bible')] : [],
      downloadModule: vi.fn(async () => {
        installed = true
        await settingsStore.updateSettings((settings) => ({
          ...settings,
          installedModuleIds: ['web'],
        }))
      }),
    })
    await model.refresh()

    await model.download('web')

    expect(model.view.rows[0].installed).toBe(true)
    expect(model.view.settings.defaultTranslationId).toBe('web')
  })

  it('deletes a module and reflects the remaining state', async () => {
    let installed = true
    const deleteModule = vi.fn(async () => {
      installed = false
    })
    const { model } = setup({
      storedSettings: { installedModuleIds: ['web'] },
      availableTranslations: async () => [
        { id: 'web', name: 'World English Bible', language: 'English' },
      ],
      installedManifests: async () =>
        installed ? [manifest('web', 'World English Bible')] : [],
      deleteModule,
    })
    await model.refresh()

    await model.remove('web')

    expect(deleteModule).toHaveBeenCalledWith('web')
    expect(model.view.rows[0].installed).toBe(false)
  })

  it('notifies subscribers when an action changes the view', async () => {
    const { model } = setup({
      availableTranslations: async () => [
        { id: 'web', name: 'World English Bible', language: 'English' },
      ],
    })
    await model.refresh()
    let notified = 0
    model.subscribe(() => (notified += 1))

    await model.download('web')

    expect(notified).toBeGreaterThanOrEqual(2)
  })

  it('offers the catalog languages for the filter dropdown', async () => {
    const { model } = setup({
      availableTranslations: async () => [
        { id: 'web', name: 'World English Bible', language: 'English' },
        { id: 'aov', name: 'Ou Vertaling', language: 'Afrikaans' },
        { id: 'kjv', name: 'King James Version', language: 'English' },
      ],
    })

    await model.refresh()

    expect(model.view.languages).toEqual(['Afrikaans', 'English'])
  })
})
