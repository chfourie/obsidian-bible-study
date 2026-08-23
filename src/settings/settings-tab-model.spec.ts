import { describe, expect, it, vi } from 'vitest'
import { SettingsStore, type ScriptureStudySettings } from '../data-access'
import { MODULE_FORMAT_VERSION, type ModuleManifest } from '../modules'
import { SettingsTabModel, type SettingsTabDeps } from './settings-tab-model'

const manifest = (
  id: string,
  name = id.toUpperCase(),
  tagged = false,
  formatVersion = MODULE_FORMAT_VERSION,
): ModuleManifest => ({
  id,
  name,
  language: 'English',
  license: 'Public Domain',
  source: 'test',
  sourceChecksum: '',
  formatVersion,
  capabilities: { strongsTagged: tagged },
})

type SetupOverrides = Partial<SettingsTabDeps> & {
  storedSettings?: Partial<ScriptureStudySettings> & Record<string, unknown>
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
    downloadModule: vi.fn(async () => {}),
    deleteModule: vi.fn(async () => {}),
    modulesWithUpdates: async () => [],
    strongs: {
      isInstalled: async () => false,
      install: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    },
    lsj: {
      isInstalled: async () => false,
      install: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    },
    strongsGloss: async () => null,
    ...deps,
  })
  return { model, settingsStore }
}

describe('SettingsTabModel general section', () => {
  it('offers installed translation modules as default options, ignoring legacy online settings', async () => {
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
    ])
  })

  it('restricts fallback options to installed modules', async () => {
    const { model } = setup({
      storedSettings: { installedModuleIds: ['web'] },
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
  it('lists rows matching the language filter, with no online rows even when a legacy key is stored', async () => {
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
      expect.objectContaining({ id: 'web', installed: false }),
      expect.objectContaining({ id: 'bsb', strongsTagged: true }),
    ])
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

  it('flags installed rows stored in an older module format', async () => {
    const { model } = setup({
      storedSettings: { installedModuleIds: ['web', 'kjv'] },
      installedManifests: async () => [
        manifest('web', 'World English Bible', false, 1),
        manifest('kjv', 'King James Version'),
      ],
      availableTranslations: async () => [
        { id: 'web', name: 'World English Bible', language: 'English' },
        { id: 'kjv', name: 'King James Version', language: 'English' },
      ],
    })

    await model.refresh()

    expect(model.view.rows).toEqual([
      expect.objectContaining({ id: 'web', formatOutdated: true }),
      expect.objectContaining({ id: 'kjv', formatOutdated: false }),
    ])
  })

  it('never flags uninstalled rows as format-outdated', async () => {
    const { model } = setup({
      availableTranslations: async () => [
        { id: 'web', name: 'World English Bible', language: 'English' },
      ],
    })

    await model.refresh()

    expect(model.view.rows[0].formatOutdated).toBe(false)
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

describe('SettingsTabModel split refresh', () => {
  it('refreshLocal loads settings, manifests, and Strongs state without touching the network', async () => {
    const availableTranslations = vi.fn(async () => [])
    const modulesWithUpdates = vi.fn(async () => [])
    const { model } = setup({
      storedSettings: { installedModuleIds: ['web'] },
      installedManifests: async () => [manifest('web', 'World English Bible')],
      availableTranslations,
      modulesWithUpdates,
      strongs: {
        isInstalled: async () => true,
        install: vi.fn(async () => {}),
        remove: vi.fn(async () => {}),
      },
    })

    await model.refreshLocal()

    expect(model.view.defaultTranslationOptions).toEqual([
      { id: 'web', label: 'World English Bible' },
    ])
    expect(model.view.strongsInstalled).toBe(true)
    expect(availableTranslations).not.toHaveBeenCalled()
    expect(modulesWithUpdates).not.toHaveBeenCalled()
  })

  it('refreshCatalog loads the catalogue and update markers and notifies', async () => {
    const { model } = setup({
      storedSettings: { installedModuleIds: ['bsb'] },
      installedManifests: async () => [
        manifest('bsb', 'Berean Standard Bible', true),
      ],
      availableTranslations: async () => [
        { id: 'bsb', name: 'Berean Standard Bible', language: 'English' },
        { id: 'web', name: 'World English Bible', language: 'English' },
      ],
      modulesWithUpdates: async () => ['bsb'],
    })
    await model.refreshLocal()
    let notified = 0
    model.subscribe(() => (notified += 1))

    await model.refreshCatalog()

    expect(model.view.rows).toEqual([
      expect.objectContaining({ id: 'bsb', installed: true, updateAvailable: true }),
      expect.objectContaining({ id: 'web', installed: false }),
    ])
    expect(notified).toBe(1)
  })
})

describe('SettingsTabModel settings mutations', () => {
  it('persists the language filter', async () => {
    const { model, settingsStore } = setup()
    await model.refresh()

    await model.setLanguageFilter('Afrikaans')

    expect((await settingsStore.loadSettings()).languageFilter).toBe('Afrikaans')
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
      readerNavDefault: { desktop: 'breadcrumb', mobile: 'tree' },
    }))

    const settings = await settingsStore.loadSettings()
    expect(settings.defaultTranslationId).toBe('bsb')
    expect(settings.readerNavDefault).toEqual({
      desktop: 'breadcrumb',
      mobile: 'tree',
    })
    expect(model.view.settings.readerNavDefault).toEqual({
      desktop: 'breadcrumb',
      mobile: 'tree',
    })
  })
})

describe('SettingsTabModel word cloud exclusions', () => {
  const glossed = async (family: string): Promise<string | null> =>
    family === 'H0834' ? 'which' : null

  it('lists each excluded family with its gloss, or its number alone', async () => {
    const { model } = setup({
      storedSettings: { wordCloudExclusions: ['H0834', 'G9999'] },
      strongsGloss: glossed,
    })

    await model.refresh()

    expect(model.view.wordCloudExclusions).toEqual([
      { family: 'H0834', label: 'H0834 · which' },
      { family: 'G9999', label: 'G9999' },
    ])
  })

  it('removes an exclusion and persists the rest', async () => {
    const { model, settingsStore } = setup({
      storedSettings: { wordCloudExclusions: ['H0834', 'G9999'] },
      strongsGloss: glossed,
    })
    await model.refresh()

    await model.removeWordCloudExclusion('H0834')

    expect((await settingsStore.loadSettings()).wordCloudExclusions).toEqual([
      'G9999',
    ])
    expect(model.view.wordCloudExclusions).toEqual([
      { family: 'G9999', label: 'G9999' },
    ])
  })

  it('labels an exclusion added behind its back once reloaded', async () => {
    const { model, settingsStore } = setup({ strongsGloss: glossed })
    await model.refresh()

    await settingsStore.updateSettings((settings) => ({
      ...settings,
      wordCloudExclusions: ['H0834'],
    }))
    await model.refreshLocal()

    expect(model.view.wordCloudExclusions).toEqual([
      { family: 'H0834', label: 'H0834 · which' },
    ])
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

const bookManifest = (
  id = 'hum-m1895',
  name = 'Humility',
  editionCode = 'HUM-M1895',
): ModuleManifest => ({
  id,
  name,
  language: 'English',
  license: 'Public Domain',
  source: 'test',
  sourceChecksum: '',
  formatVersion: MODULE_FORMAT_VERSION,
  kind: 'book',
  capabilities: { strongsTagged: false },
  book: {
    number: 101,
    editionCode,
    author: 'Andrew Murray',
    year: 1895,
    abbreviation: 'Hum',
    sections: [{ chapter: 0, name: 'Preface', paragraphs: 4 }],
  },
})

describe('SettingsTabModel books section', () => {
  it('lists the compiled-in book catalogue as uninstalled rows', async () => {
    const { model } = setup()

    await model.refresh()

    expect(model.view.bookRows).toEqual([
      {
        id: 'hum-m1895',
        title: 'Humility',
        author: 'Andrew Murray',
        editionCode: 'HUM-M1895',
        installed: false,
        busy: null,
        error: null,
        updateAvailable: false,
      },
      {
        id: 'in-at-e1',
        title: 'IN',
        author: 'A Team',
        editionCode: 'IN-AT-E1',
        installed: false,
        busy: null,
        error: null,
        updateAvailable: false,
      },
    ])
  })

  it('marks a catalogued book installed once its manifest is on disk', async () => {
    const { model } = setup({
      storedSettings: { installedModuleIds: ['hum-m1895'] },
      installedManifests: async () => [bookManifest()],
    })

    await model.refresh()

    expect(model.view.bookRows[0].installed).toBe(true)
  })

  it('offers a one-click re-download on a fresh device carrying only the synced id', async () => {
    const { model } = setup({
      storedSettings: { installedModuleIds: ['hum-m1895'] },
      installedManifests: async () => [],
    })

    await model.refresh()

    expect(model.view.bookRows[0].installed).toBe(false)
  })

  it('surfaces an available update for an installed book', async () => {
    const { model } = setup({
      installedManifests: async () => [bookManifest()],
      modulesWithUpdates: async () => ['hum-m1895'],
    })

    await model.refresh()

    expect(model.view.bookRows[0].updateAvailable).toBe(true)
  })

  it('lists an installed book the catalogue no longer carries', async () => {
    const { model } = setup({
      installedManifests: async () => [
        bookManifest('hum-m1901', 'Humility', 'HUM-M1901'),
      ],
    })

    await model.refresh()

    expect(model.view.bookRows.map((row) => row.id)).toEqual([
      'hum-m1895',
      'in-at-e1',
      'hum-m1901',
    ])
  })

  it('shares the busy and error state with the translation rows', async () => {
    const { model } = setup({
      downloadModule: vi.fn(async () => {
        throw new Error('release not published')
      }),
    })
    await model.refresh()

    await model.download('hum-m1895')

    expect(model.view.bookRows[0].busy).toBe(null)
    expect(model.view.bookRows[0].error).toBe('release not published')
  })

  it('keeps books out of the translation rows and both pickers', async () => {
    const { model } = setup({
      storedSettings: { installedModuleIds: ['web', 'hum-m1895'] },
      installedManifests: async () => [
        manifest('web', 'World English Bible'),
        bookManifest(),
      ],
    })

    await model.refresh()

    expect(model.view.rows.map((row) => row.id)).toEqual(['web'])
    expect(model.view.defaultTranslationOptions).toEqual([
      { id: 'web', label: 'World English Bible' },
    ])
    expect(model.view.fallbackTranslationOptions).toEqual([
      { id: 'web', label: 'World English Bible' },
    ])
  })
})

describe('SettingsTabModel LSJ section', () => {
  it('reports whether the LSJ Lexicon is installed', async () => {
    const { model } = setup({
      lsj: {
        isInstalled: async () => true,
        install: vi.fn(async () => {}),
        remove: vi.fn(async () => {}),
      },
    })

    await model.refresh()

    expect(model.view.lsjInstalled).toBe(true)
  })

  it('downloads the lexicon when it is enabled and removes it when disabled', async () => {
    let installed = false
    const lsj = {
      isInstalled: async () => installed,
      install: vi.fn(async () => {
        installed = true
      }),
      remove: vi.fn(async () => {
        installed = false
      }),
    }
    const { model } = setup({ lsj })
    await model.refresh()

    await model.setLsjEnabled(true)
    expect(lsj.install).toHaveBeenCalled()
    expect(model.view.lsjInstalled).toBe(true)

    await model.setLsjEnabled(false)
    expect(lsj.remove).toHaveBeenCalled()
    expect(model.view.lsjInstalled).toBe(false)
  })

  it('surfaces a failed LSJ install and clears the busy state', async () => {
    const { model } = setup({
      lsj: {
        isInstalled: async () => false,
        install: vi.fn(async () => {
          throw new Error('network gone')
        }),
        remove: vi.fn(async () => {}),
      },
    })
    await model.refresh()

    await model.setLsjEnabled(true)

    expect(model.view.lsjBusy).toBe(false)
    expect(model.view.lsjError).toBe('network gone')
    expect(model.view.lsjInstalled).toBe(false)
  })

  it('leaves the Strongs toggle alone while the LSJ install fails', async () => {
    const { model } = setup({
      lsj: {
        isInstalled: async () => false,
        install: vi.fn(async () => {
          throw new Error('network gone')
        }),
        remove: vi.fn(async () => {}),
      },
    })
    await model.refresh()

    await model.setLsjEnabled(true)

    expect(model.view.strongsError).toBe(null)
  })
})
