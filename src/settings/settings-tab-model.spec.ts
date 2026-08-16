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

describe('SettingsTabModel settings mutations', () => {
  it('stores a trimmed API key and unmasks the online tier', async () => {
    const { model, settingsStore } = setup()
    await model.refresh()

    await model.setApiBibleKey('  key-123  ')

    expect((await settingsStore.loadSettings()).apiBibleKey).toBe('key-123')
    expect(model.view.rows.some((row) => row.tier === 'online')).toBe(true)
  })

  it('clears the API key when the input is blanked', async () => {
    const { model, settingsStore } = setup({
      storedSettings: { apiBibleKey: 'key-123' },
    })
    await model.refresh()

    await model.setApiBibleKey('   ')

    expect((await settingsStore.loadSettings()).apiBibleKey).toBe(null)
  })

  it('persists the language filter', async () => {
    const { model, settingsStore } = setup()
    await model.refresh()

    await model.setLanguageFilter('Afrikaans')

    expect((await settingsStore.loadSettings()).languageFilter).toBe('Afrikaans')
  })

  it('enables an online translation, making it a default candidate', async () => {
    const { model, settingsStore } = setup({
      storedSettings: { apiBibleKey: 'key-123' },
    })
    await model.refresh()

    await model.setOnlineEnabled('nkjv', true)

    const settings = await settingsStore.loadSettings()
    expect(settings.enabledOnlineTranslationIds).toEqual(['nkjv'])
    expect(settings.defaultTranslationId).toBe('nkjv')
  })

  it('disables an online translation again', async () => {
    const { model, settingsStore } = setup({
      storedSettings: {
        apiBibleKey: 'key-123',
        enabledOnlineTranslationIds: ['nkjv'],
      },
    })
    await model.refresh()

    await model.setOnlineEnabled('nkjv', false)

    expect(
      (await settingsStore.loadSettings()).enabledOnlineTranslationIds,
    ).toEqual([])
  })

  it('clears cached passages for an online translation', async () => {
    const clearPassageCache = vi.fn(async () => {})
    const { model } = setup({ clearPassageCache })
    await model.refresh()

    await model.clearCache('nkjv')

    expect(clearPassageCache).toHaveBeenCalledWith('nkjv')
  })

  it('persists picker and preference choices through a shared updater', async () => {
    const { model, settingsStore } = setup({
      storedSettings: { installedModuleIds: ['web', 'bsb'] },
      installedManifests: async () => [manifest('web'), manifest('bsb')],
    })
    await model.refresh()

    await model.updateSettings((settings) => ({
      ...settings,
      defaultTranslationId: 'bsb',
      readerNavDefault: 'breadcrumb',
    }))

    const settings = await settingsStore.loadSettings()
    expect(settings.defaultTranslationId).toBe('bsb')
    expect(settings.readerNavDefault).toBe('breadcrumb')
    expect(model.view.settings.readerNavDefault).toBe('breadcrumb')
  })
})

describe('SettingsTabModel Strongs section', () => {
  it('reports whether the dictionaries and any tagged translation are installed', async () => {
    const { model } = setup({
      storedSettings: { installedModuleIds: ['bsb'] },
      installedManifests: async () => [
        manifest('bsb', 'Berean Standard Bible', true),
      ],
      strongs: {
        isInstalled: async () => true,
        install: vi.fn(async () => {}),
        remove: vi.fn(async () => {}),
      },
    })

    await model.refresh()

    expect(model.view.strongsInstalled).toBe(true)
    expect(model.view.taggedTranslationInstalled).toBe(true)
  })

  it('downloads the dictionaries when Strongs is enabled and removes them when disabled', async () => {
    let installed = false
    const strongs = {
      isInstalled: async () => installed,
      install: vi.fn(async () => {
        installed = true
      }),
      remove: vi.fn(async () => {
        installed = false
      }),
    }
    const { model } = setup({ strongs })
    await model.refresh()

    await model.setStrongsEnabled(true)
    expect(strongs.install).toHaveBeenCalled()
    expect(model.view.strongsInstalled).toBe(true)

    await model.setStrongsEnabled(false)
    expect(strongs.remove).toHaveBeenCalled()
    expect(model.view.strongsInstalled).toBe(false)
  })

  it('surfaces a failed dictionaries install and clears the busy state', async () => {
    const { model } = setup({
      strongs: {
        isInstalled: async () => false,
        install: vi.fn(async () => {
          throw new Error('network gone')
        }),
        remove: vi.fn(async () => {}),
      },
    })
    await model.refresh()

    await model.setStrongsEnabled(true)

    expect(model.view.strongsBusy).toBe(false)
    expect(model.view.strongsError).toBe('network gone')
    expect(model.view.strongsInstalled).toBe(false)
  })

  it('clears a previous Strongs error when the toggle is retried', async () => {
    let installed = false
    let failNext = true
    const { model } = setup({
      strongs: {
        isInstalled: async () => installed,
        install: vi.fn(async () => {
          if (failNext) throw new Error('network gone')
          installed = true
        }),
        remove: vi.fn(async () => {}),
      },
    })
    await model.refresh()
    await model.setStrongsEnabled(true)
    failNext = false

    await model.setStrongsEnabled(true)

    expect(model.view.strongsError).toBe(null)
    expect(model.view.strongsInstalled).toBe(true)
  })
})
