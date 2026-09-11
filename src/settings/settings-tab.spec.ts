import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Plugin as ObsidianPlugin } from 'obsidian'
import {
  AbstractInputSuggest,
  App,
  Plugin,
  TFile,
  TFolder,
} from '../../tests/mocks/obsidian'
import {
  defaultHighlightPalette,
  defaultHighlightWash,
  defaultUnderlinePalette,
  SettingsStore,
  type ScriptureStudySettings,
} from '../data-access'
import { MODULE_FORMAT_VERSION, type ModuleManifest } from '../modules'
import { ScriptureStudySettingTab } from './settings-tab'
import { SettingsTabModel, type SettingsTabDeps } from './settings-tab-model'

const moduleManifest = (
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

const pluginManifest = {
  id: 'scripture-study',
  name: 'Scripture Study',
  version: '0.0.0',
  minAppVersion: '1.0.0',
  description: '',
  author: '',
}

type SetupOverrides = Partial<SettingsTabDeps> & {
  storedSettings?: Partial<ScriptureStudySettings> & Record<string, unknown>
}

const flushAsync = () => new Promise((resolve) => window.setTimeout(resolve, 0))

// Navigates the mock tab like a user: into a declarative sub-page and back.
// Structural casts — the mock's page navigation mirrors the real runtime's
// internal pageStack, which is absent from the public typings.
const renderTab = (tab: unknown): void =>
  (tab as { renderTab(): void }).renderTab()
const openPage = (tab: unknown, name: string): void =>
  (tab as { openPage(name: string): void }).openPage(name)
const closePage = (tab: unknown): void =>
  (tab as { closePage(): void }).closePage()

const setup = async (
  overrides: SetupOverrides = {},
  {
    opened = true,
    page = null,
  }: { opened?: boolean; page?: string | null } = {},
) => {
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
  const app = new App()
  const plugin = new Plugin(app, pluginManifest) as unknown as ObsidianPlugin
  const tab = new ScriptureStudySettingTab(plugin, model)
  // Registration + open follow the real 1.13.7 lifecycle (see the mock's
  // PluginSettingTab). The structural cast reaches the mock's renderTab(),
  // absent from the public typings.
  plugin.addSettingTab(tab)
  if (opened) {
    document.body.appendChild(tab.containerEl)
    renderTab(tab)
    if (page !== null) {
      await flushAsync()
      openPage(tab, page)
    }
  }
  await flushAsync()
  return { tab, model, settingsStore, app, container: tab.containerEl }
}

const settingItems = (container: HTMLElement): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>('.setting-item'),
]

const settingName = (item: HTMLElement): string =>
  item.querySelector('.setting-item-name')?.textContent ?? ''

const firstSettingNamed = (
  items: HTMLElement[],
  name: string,
  where: string,
): HTMLElement => {
  const found = items.find((item) => settingName(item).startsWith(name))
  if (!found) throw new Error(`no setting named ${name}${where}`)
  return found
}

const settingNamed = (container: HTMLElement, name: string): HTMLElement =>
  firstSettingNamed(settingItems(container), name, '')

// The setting of that name under the given group heading — "Folder" and
// "Template file" appear under more than one heading.
const settingNamedUnder = (
  container: HTMLElement,
  heading: string,
  name: string,
): HTMLElement => {
  const items = settingItems(container)
  const start = items.findIndex(
    (item) =>
      item.classList.contains('setting-item-heading') &&
      settingName(item) === heading,
  )
  if (start < 0) throw new Error(`no heading named ${heading}`)
  return firstSettingNamed(items.slice(start + 1), name, ` under ${heading}`)
}

const hasSettingNamed = (container: HTMLElement, name: string): boolean =>
  settingItems(container).some((item) => settingName(item).startsWith(name))

const dropdownOf = (setting: HTMLElement): HTMLSelectElement => {
  const dropdown = setting.querySelector('select')
  if (!dropdown) throw new Error('setting has no dropdown')
  return dropdown
}

const inputOf = (setting: HTMLElement): HTMLInputElement => {
  const input = setting.querySelector('input')
  if (!input) throw new Error('setting has no input')
  return input
}

const toggleOf = (setting: HTMLElement): HTMLInputElement => {
  const toggle = setting.querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  )
  if (!toggle) throw new Error('setting has no toggle')
  return toggle
}

const changeDropdown = (setting: HTMLElement, value: string): void => {
  const dropdown = dropdownOf(setting)
  dropdown.value = value
  dropdown.dispatchEvent(new Event('change'))
}

const changeInput = (setting: HTMLElement, value: string): void => {
  const input = inputOf(setting)
  input.value = value
  input.dispatchEvent(new Event('change'))
}

const changeToggle = (setting: HTMLElement, checked: boolean): void => {
  const toggle = toggleOf(setting)
  toggle.checked = checked
  toggle.dispatchEvent(new Event('change'))
}

beforeEach(() => {
  document.body.replaceChildren()
  AbstractInputSuggest.created.length = 0
})

describe('ScriptureStudySettingTab declarative definitions', () => {
  it('exposes named setting definitions for the settings search index', async () => {
    const { tab } = await setup()

    const definitions = tab.getSettingDefinitions()
    expect(definitions.length).toBeGreaterThan(0)

    const names = definitions.flatMap((item) =>
      'items' in item
        ? (item.items ?? []).map((child) => ('name' in child ? child.name : ''))
        : 'name' in item
          ? [item.name]
          : [],
    )
    expect(names).toEqual(
      expect.arrayContaining([
        'Default translation',
        'Offline fallback translation',
        'Derived red letter',
        'Page breaks',
        'Reveal Study Panel on selection',
        'Language',
        "Enable Strong's",
        'Navigation (desktop)',
        'Navigation (mobile)',
        'Layout (desktop)',
        'Layout (mobile)',
        "Strong's mode (desktop)",
        "Strong's mode (mobile)",
        'Folder',
        'Template file',
        'Display ordering',
        'Slot 1',
        'Opacity (light mode)',
        'Opacity (dark mode)',
        'Reset highlights',
      ]),
    )
  })

  it('does not refresh the model from the index-time call while the tab is closed', async () => {
    const availableTranslations = vi.fn(async () => [])
    const { tab } = await setup({ availableTranslations }, { opened: false })

    // Obsidian calls getSettingDefinitions once at addSettingTab() to index
    // the tab for settings search, long before the user opens it.
    expect(tab.getSettingDefinitions().length).toBeGreaterThan(0)
    await flushAsync()

    expect(availableTranslations).not.toHaveBeenCalled()
  })

  it('loads translation rows when opened from the cached index-time definitions', async () => {
    // Obsidian 1.13.7 never calls getSettingDefinitions() on open when the
    // index-time update() already cached definitions — the tab must bootstrap
    // its model from the render itself (see the workaround note in
    // settings-tab.ts) or the Translations section stays permanently empty.
    const { container } = await setup(
      {
        availableTranslations: async () => [
          { id: 'web', name: 'World English Bible', language: 'English' },
        ],
      },
      { page: 'Translations' },
    )

    expect(hasSettingNamed(container, 'World English Bible')).toBe(true)
  })
})

describe('ScriptureStudySettingTab deferred catalogue fetch', () => {
  it('keeps the catalogue fetch off the main page', async () => {
    const availableTranslations = vi.fn(async () => [])
    const modulesWithUpdates = vi.fn(async () => [])
    const { container } = await setup({
      availableTranslations,
      modulesWithUpdates,
    })

    expect(hasSettingNamed(container, 'Translations')).toBe(true)
    expect(hasSettingNamed(container, 'Language')).toBe(false)
    expect(availableTranslations).not.toHaveBeenCalled()
    expect(modulesWithUpdates).not.toHaveBeenCalled()
  })

  it('fetches the catalogue once when the Translations page opens, despite re-renders', async () => {
    const availableTranslations = vi.fn(async () => [
      { id: 'web', name: 'World English Bible', language: 'English' },
    ])
    const { container } = await setup(
      { availableTranslations },
      { page: 'Translations' },
    )

    expect(hasSettingNamed(container, 'World English Bible')).toBe(true)
    expect(availableTranslations).toHaveBeenCalledTimes(1)
  })

  it('does not refetch when the page is reopened within one settings session', async () => {
    const availableTranslations = vi.fn(async () => [
      { id: 'web', name: 'World English Bible', language: 'English' },
    ])
    const { tab, container } = await setup(
      { availableTranslations },
      { page: 'Translations' },
    )

    closePage(tab)
    openPage(tab, 'Translations')
    await flushAsync()

    expect(hasSettingNamed(container, 'World English Bible')).toBe(true)
    expect(availableTranslations).toHaveBeenCalledTimes(1)
  })

  it('fetches again when settings are closed and reopened', async () => {
    const availableTranslations = vi.fn(async () => [
      { id: 'web', name: 'World English Bible', language: 'English' },
    ])
    const { tab } = await setup(
      { availableTranslations },
      { page: 'Translations' },
    )

    tab.hide()
    renderTab(tab)
    await flushAsync()
    openPage(tab, 'Translations')
    await flushAsync()

    expect(availableTranslations).toHaveBeenCalledTimes(2)
  })
})

describe('ScriptureStudySettingTab general pickers', () => {
  it('renders disabled placeholders while no translations are available', async () => {
    const { container } = await setup()

    for (const name of ['Default translation', 'Offline fallback translation']) {
      const dropdown = dropdownOf(settingNamed(container, name))
      expect(dropdown.disabled).toBe(true)
      expect(dropdown.options[0].textContent).toBe(
        'No translations installed — see Translations below',
      )
    }
  })

  it('lists installed translations and persists a new default', async () => {
    const { container, settingsStore } = await setup({
      storedSettings: { installedModuleIds: ['web', 'bsb'] },
      installedManifests: async () => [
        moduleManifest('web', 'World English Bible'),
        moduleManifest('bsb', 'Berean Standard Bible'),
      ],
    })

    const picker = settingNamed(container, 'Default translation')
    expect([...dropdownOf(picker).options].map((option) => option.value)).toEqual(
      ['web', 'bsb'],
    )
    expect(dropdownOf(picker).value).toBe('web')

    changeDropdown(picker, 'bsb')
    await flushAsync()

    expect((await settingsStore.loadSettings()).defaultTranslationId).toBe('bsb')
  })

  it('persists the offline fallback translation', async () => {
    const { container, settingsStore } = await setup({
      storedSettings: { installedModuleIds: ['web', 'bsb'] },
      installedManifests: async () => [
        moduleManifest('web', 'World English Bible'),
        moduleManifest('bsb', 'Berean Standard Bible'),
      ],
    })

    changeDropdown(settingNamed(container, 'Offline fallback translation'), 'bsb')
    await flushAsync()

    expect((await settingsStore.loadSettings()).fallbackTranslationId).toBe('bsb')
  })
})

describe('ScriptureStudySettingTab translations section', () => {
  it('offers catalog languages plus the persisted filter, and persists changes', async () => {
    const { container, settingsStore } = await setup({
      storedSettings: { languageFilter: 'Zulu' },
      availableTranslations: async () => [
        { id: 'web', name: 'World English Bible', language: 'English' },
        { id: 'aov', name: 'Ou Vertaling', language: 'Afrikaans' },
      ],
    }, { page: 'Translations' })

    const language = settingNamed(container, 'Language')
    expect([...dropdownOf(language).options].map((option) => option.value)).toEqual(
      ['Afrikaans', 'English', 'Zulu'],
    )
    expect(dropdownOf(language).value).toBe('Zulu')

    changeDropdown(language, 'Afrikaans')
    await flushAsync()

    expect((await settingsStore.loadSettings()).languageFilter).toBe('Afrikaans')
  })

  it('downloads from the row button, showing progress until the module lands', async () => {
    let resolveDownload: () => void = () => {}
    const downloadModule = vi.fn(
      () => new Promise<void>((resolve) => (resolveDownload = resolve)),
    )
    const { container } = await setup({
      availableTranslations: async () => [
        { id: 'web', name: 'World English Bible', language: 'English' },
      ],
      downloadModule,
    }, { page: 'Translations' })

    const download = settingNamed(container, 'World English Bible').querySelector(
      'button',
    )
    expect(download?.textContent).toBe('Download')
    expect(download?.classList.contains('mod-cta')).toBe(true)

    download?.click()

    const busy = settingNamed(container, 'World English Bible').querySelector(
      'button',
    )
    expect(busy?.textContent).toBe('Downloading…')
    expect(busy?.disabled).toBe(true)
    expect(downloadModule).toHaveBeenCalledWith('web')

    resolveDownload()
    await flushAsync()

    expect(
      settingNamed(container, 'World English Bible').querySelector('button')
        ?.textContent,
    ).toBe('Download')
  })

  it('surfaces a failed download on the row', async () => {
    const { container } = await setup({
      availableTranslations: async () => [
        { id: 'web', name: 'World English Bible', language: 'English' },
      ],
      downloadModule: vi.fn(async () => {
        throw new Error('network gone')
      }),
    }, { page: 'Translations' })

    settingNamed(container, 'World English Bible').querySelector('button')?.click()
    await flushAsync()

    expect(
      settingNamed(container, 'World English Bible').querySelector(
        '.scripture-study-settings-error',
      )?.textContent,
    ).toBe('network gone')
  })

  it('offers Update and Delete on an installed row with an update, badged when tagged', async () => {
    const deleteModule = vi.fn(async () => {})
    const { container } = await setup({
      storedSettings: { installedModuleIds: ['bsb'] },
      installedManifests: async () => [
        moduleManifest('bsb', 'Berean Standard Bible', true),
      ],
      availableTranslations: async () => [
        { id: 'bsb', name: 'Berean Standard Bible', language: 'English' },
      ],
      modulesWithUpdates: async () => ['bsb'],
      deleteModule,
    }, { page: 'Translations' })

    const row = settingNamed(container, 'Berean Standard Bible')
    expect(row.querySelector('.scripture-study-strongs-badge')?.textContent).toBe(
      "Strong's",
    )
    const buttons = [...row.querySelectorAll('button')]
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Update',
      'Delete',
    ])
    expect(buttons[1].classList.contains('mod-destructive')).toBe(true)

    buttons[1].click()
    await flushAsync()

    expect(deleteModule).toHaveBeenCalledWith('bsb')
  })

  it('offers Re-download and Delete on an installed catalogue row — bolls publishes no checksums, so updating is re-downloading', async () => {
    const downloadModule = vi.fn(async () => {})
    const { container } = await setup({
      storedSettings: { installedModuleIds: ['kjv'] },
      installedManifests: async () => [
        moduleManifest('kjv', 'King James Version', true),
      ],
      availableTranslations: async () => [
        { id: 'kjv', name: 'King James Version', language: 'English' },
      ],
      downloadModule,
    }, { page: 'Translations' })

    const row = settingNamed(container, 'King James Version')
    const buttons = [...row.querySelectorAll('button')]
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Re-download',
      'Delete',
    ])
    expect(buttons[0].classList.contains('mod-cta')).toBe(false)

    buttons[0].click()
    await flushAsync()

    expect(downloadModule).toHaveBeenCalledWith('kjv')
  })

  it('offers Update with a format note on an installed row stored in an older module format', async () => {
    const downloadModule = vi.fn(async () => {})
    const { container } = await setup({
      storedSettings: { installedModuleIds: ['kjv'] },
      installedManifests: async () => [
        moduleManifest('kjv', 'King James Version', true, 1),
      ],
      availableTranslations: async () => [
        { id: 'kjv', name: 'King James Version', language: 'English' },
      ],
      downloadModule,
    }, { page: 'Translations' })

    const row = settingNamed(container, 'King James Version')
    const buttons = [...row.querySelectorAll('button')]
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Update',
      'Delete',
    ])
    expect(buttons[0].classList.contains('mod-cta')).toBe(true)
    expect(row.querySelector('.setting-item-description')?.textContent).toContain(
      'newest module format',
    )

    buttons[0].click()
    await flushAsync()

    expect(downloadModule).toHaveBeenCalledWith('kjv')
  })

  it('shows no format note on an outdated module the catalogue no longer lists', async () => {
    const { container } = await setup({
      storedSettings: { installedModuleIds: ['legacy'] },
      installedManifests: async () => [
        moduleManifest('legacy', 'Legacy Module', false, 1),
      ],
      availableTranslations: async () => [],
    }, { page: 'Translations' })

    const row = settingNamed(container, 'Legacy Module')
    expect(
      [...row.querySelectorAll('button')].map((button) => button.textContent),
    ).toEqual(['Delete'])
    expect(row.querySelector('.setting-item-description')?.textContent ?? '').not.toContain(
      'newest module format',
    )
  })

  it('offers only Delete on an installed module the catalogue no longer lists', async () => {
    const { container } = await setup({
      storedSettings: { installedModuleIds: ['legacy'] },
      installedManifests: async () => [moduleManifest('legacy', 'Legacy Module')],
      availableTranslations: async () => [],
    }, { page: 'Translations' })

    const row = settingNamed(container, 'Legacy Module')
    expect(
      [...row.querySelectorAll('button')].map((button) => button.textContent),
    ).toEqual(['Delete'])
  })

  it('lists catalogue rows on the Translations sub-page, with no tier heading', async () => {
    const { container } = await setup(
      {
        availableTranslations: async () => [
          { id: 'web', name: 'World English Bible', language: 'English' },
        ],
      },
      { page: 'Translations' },
    )

    expect(hasSettingNamed(container, 'Downloadable')).toBe(false)
    expect(settingItems(container).map(settingName)).toEqual([
      'Language',
      'World English Bible',
    ])
  })

  it('renders no API key input or online rows, even with a legacy key stored', async () => {
    const { container } = await setup({
      storedSettings: { apiBibleKey: 'key-123' },
    })

    expect(hasSettingNamed(container, 'API.Bible key')).toBe(false)
    expect(hasSettingNamed(container, 'Online — requires key')).toBe(false)
    expect(hasSettingNamed(container, 'New King James Version')).toBe(false)
  })
})

describe('ScriptureStudySettingTab Strongs section', () => {
  it('installs the dictionaries from the toggle', async () => {
    const strongs = {
      isInstalled: async () => false,
      install: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    }
    const { container } = await setup({ strongs })

    changeToggle(settingNamed(container, "Enable Strong's"), true)
    await flushAsync()

    expect(strongs.install).toHaveBeenCalled()
  })

  it('surfaces a failed dictionaries install on the setting', async () => {
    const { container } = await setup({
      strongs: {
        isInstalled: async () => false,
        install: vi.fn(async () => {
          throw new Error('network gone')
        }),
        remove: vi.fn(async () => {}),
      },
    })

    changeToggle(settingNamed(container, "Enable Strong's"), true)
    await flushAsync()

    expect(
      settingNamed(container, "Enable Strong's").querySelector(
        '.scripture-study-settings-error',
      )?.textContent,
    ).toBe('network gone')
  })

  it('points at badged translations only while none is installed', async () => {
    const { container } = await setup()
    expect(
      settingNamed(container, "Enable Strong's").textContent,
    ).toContain("Strong's badge")

    const { container: withTagged } = await setup({
      storedSettings: { installedModuleIds: ['bsb'] },
      installedManifests: async () => [
        moduleManifest('bsb', 'Berean Standard Bible', true),
      ],
    })
    expect(
      settingNamed(withTagged, "Enable Strong's").textContent,
    ).not.toContain("Strong's badge")
  })
})

describe('ScriptureStudySettingTab word cloud section', () => {
  it('says so while the user has excluded nothing', async () => {
    const { container } = await setup()

    expect(hasSettingNamed(container, 'No words excluded')).toBe(true)
  })

  it('lists each excluded family, labelled, with a Remove that drops it', async () => {
    const { container, settingsStore } = await setup({
      storedSettings: { wordCloudExclusions: ['H0834', 'G9999'] },
      strongsGloss: async (family) => (family === 'H0834' ? 'which' : null),
    })
    const which = settingNamed(container, 'H0834 · which')
    expect(hasSettingNamed(container, 'G9999')).toBe(true)
    const remove = which.querySelector('button')
    expect(remove?.textContent).toBe('Remove')

    remove?.click()
    await flushAsync()

    expect((await settingsStore.loadSettings()).wordCloudExclusions).toEqual([
      'G9999',
    ])
    expect(hasSettingNamed(container, 'H0834')).toBe(false)
  })
})

describe('ScriptureStudySettingTab derived red letter', () => {
  it('persists the derived red letter toggle, default off', async () => {
    const { container, settingsStore } = await setup()

    const setting = settingNamed(container, 'Derived red letter')
    expect(toggleOf(setting).checked).toBe(false)

    changeToggle(setting, true)
    await flushAsync()

    expect((await settingsStore.loadSettings()).derivedRedLetter).toBe(true)
  })
})

describe('ScriptureStudySettingTab page breaks', () => {
  it('persists the page breaks toggle, default on', async () => {
    const { container, settingsStore } = await setup()

    const setting = settingNamed(container, 'Page breaks')
    expect(toggleOf(setting).checked).toBe(true)

    changeToggle(setting, false)
    await flushAsync()

    expect((await settingsStore.loadSettings()).pageBreaks).toBe(false)
  })
})

describe('ScriptureStudySettingTab reveal on selection', () => {
  it('persists the reveal toggle, default on', async () => {
    const { container, settingsStore } = await setup()

    const setting = settingNamed(container, 'Reveal Study Panel on selection')
    expect(toggleOf(setting).checked).toBe(true)

    changeToggle(setting, false)
    await flushAsync()

    expect((await settingsStore.loadSettings()).revealPanelOnSelection).toBe(
      false,
    )
  })
})

describe('ScriptureStudySettingTab reader defaults', () => {
  it('shows separate desktop and mobile rows, both seeded from the stored default', async () => {
    const { container } = await setup()

    expect(
      dropdownOf(settingNamed(container, 'Navigation (desktop)')).value,
    ).toBe('tree')
    expect(
      dropdownOf(settingNamed(container, 'Navigation (mobile)')).value,
    ).toBe('tree')
  })

  // The atom-numbers option is a Book's own, on its settings row (§5).
  it('carries no paragraph-numbers row — a Book’s atom numbers live on its own row', async () => {
    const { container } = await setup()

    expect(hasSettingNamed(container, 'Paragraph numbers')).toBe(false)
    expect(hasSettingNamed(container, 'Para numbers')).toBe(false)
  })

  it('persists a desktop reader default change without touching the mobile slot', async () => {
    const { container, settingsStore } = await setup()

    changeDropdown(settingNamed(container, 'Navigation (desktop)'), 'breadcrumb')
    await flushAsync()

    const settings = await settingsStore.loadSettings()
    expect(settings.readerNavDefault).toEqual({
      desktop: 'breadcrumb',
      mobile: 'tree',
    })
  })

  it('persists a mobile reader default change without touching the desktop slot', async () => {
    const { container, settingsStore } = await setup()

    changeDropdown(settingNamed(container, 'Navigation (mobile)'), 'breadcrumb')
    await flushAsync()

    const settings = await settingsStore.loadSettings()
    expect(settings.readerNavDefault).toEqual({
      desktop: 'tree',
      mobile: 'breadcrumb',
    })
  })

  it('persists the reader text size slider', async () => {
    const { container, settingsStore } = await setup()

    const textSize = settingNamed(container, 'Text size')
    const slider = textSize.querySelector('input[type="range"]')
    if (!(slider instanceof HTMLInputElement)) throw new Error('no slider')
    expect(slider.value).toBe('100')

    slider.value = '130'
    slider.dispatchEvent(new Event('change'))
    await flushAsync()

    expect((await settingsStore.loadSettings()).readerFontScalePercent).toBe(130)
  })
})

describe('ScriptureStudySettingTab mentions section', () => {
  const excludeRow = (container: HTMLElement): HTMLElement =>
    settingNamedUnder(container, 'Mentions', 'Exclude a folder')

  it('says so while no folder is excluded', async () => {
    const { container } = await setup()

    expect(hasSettingNamed(container, 'No folders excluded')).toBe(true)
  })

  it('adds a typed folder, trimmed of blanks and slashes, ignoring blank and repeat entries', async () => {
    const { container, settingsStore } = await setup({
      storedSettings: { mentionExcludedFolders: ['Journal'] },
    })

    changeInput(excludeRow(container), ' /Drafts/2026/ ')
    await flushAsync()
    expect(inputOf(excludeRow(container)).value).toBe('')
    changeInput(excludeRow(container), '   ')
    await flushAsync()
    changeInput(excludeRow(container), 'Journal')
    await flushAsync()

    expect((await settingsStore.loadSettings()).mentionExcludedFolders).toEqual([
      'Journal',
      'Drafts/2026',
    ])
  })

  it('adds a folder-suggester pick', async () => {
    const { container, settingsStore, app } = await setup()
    const folder = Object.assign(new TFolder(), { path: 'Journal/2026' })
    app.vault.getAllFolders = () => [folder]

    const suggest = AbstractInputSuggest.created.find(
      (candidate) =>
        (candidate as unknown as { textInputEl: HTMLInputElement })
          .textInputEl === inputOf(excludeRow(container)),
    )
    suggest?.selectSuggestion(folder, new MouseEvent('click'))
    await flushAsync()

    expect((await settingsStore.loadSettings()).mentionExcludedFolders).toEqual([
      'Journal/2026',
    ])
  })

  it('lists each excluded folder with a Remove that drops it', async () => {
    const { container, settingsStore } = await setup({
      storedSettings: { mentionExcludedFolders: ['Journal', 'Drafts'] },
    })
    const journal = settingNamedUnder(container, 'Mentions', 'Journal')
    expect(hasSettingNamed(container, 'Drafts')).toBe(true)
    const remove = journal.querySelector('button')
    expect(remove?.textContent).toBe('Remove')

    remove?.click()
    await flushAsync()

    expect((await settingsStore.loadSettings()).mentionExcludedFolders).toEqual([
      'Drafts',
    ])
    expect(hasSettingNamed(container, 'Journal')).toBe(false)
  })
})

describe('ScriptureStudySettingTab annotations section', () => {
  it('persists a trimmed folder, falling back to the default when blanked', async () => {
    const { container, settingsStore } = await setup()

    changeInput(settingNamed(container, 'Folder'), '  Study/Notes  ')
    await flushAsync()
    expect((await settingsStore.loadSettings()).annotationsFolder).toBe(
      'Study/Notes',
    )

    changeInput(settingNamed(container, 'Folder'), '   ')
    await flushAsync()
    expect((await settingsStore.loadSettings()).annotationsFolder).toBe(
      'Annotations',
    )
  })

  it('persists the template file, clearing it when blanked', async () => {
    const { container, settingsStore } = await setup()

    changeInput(settingNamed(container, 'Template file'), 'Templates/annotation.md')
    await flushAsync()
    expect((await settingsStore.loadSettings()).annotationTemplatePath).toBe(
      'Templates/annotation.md',
    )

    changeInput(settingNamed(container, 'Template file'), '')
    await flushAsync()
    expect(
      (await settingsStore.loadSettings()).annotationTemplatePath,
    ).toBeNull()
  })

  it('persists the display ordering', async () => {
    const { container, settingsStore } = await setup()

    changeDropdown(settingNamed(container, 'Display ordering'), 'path-a-z')
    await flushAsync()

    expect((await settingsStore.loadSettings()).annotationOrdering).toBe(
      'path-a-z',
    )
  })

  it('persists the start expanded toggle, default off', async () => {
    const { container, settingsStore } = await setup()

    const setting = settingNamed(container, 'Annotations start expanded')
    expect(toggleOf(setting).checked).toBe(false)

    changeToggle(setting, true)
    await flushAsync()

    expect(
      (await settingsStore.loadSettings()).annotationsStartExpanded,
    ).toBe(true)
  })

  type SuggestUnderTest = {
    selectSuggestion(
      value: TFile | TFolder,
      evt: MouseEvent | KeyboardEvent,
    ): void
  }

  const suggestFor = (input: HTMLInputElement): SuggestUnderTest => {
    const suggest = AbstractInputSuggest.created.find(
      (candidate) =>
        (candidate as unknown as { textInputEl: HTMLInputElement })
          .textInputEl === input,
    )
    if (!suggest) throw new Error('no suggest wired to the input')
    return suggest
  }

  it('persists a folder-suggester pick', async () => {
    const { container, settingsStore, app } = await setup()
    const folder = Object.assign(new TFolder(), { path: 'Study/Annotations' })
    app.vault.getAllFolders = () => [folder]

    const suggest = suggestFor(inputOf(settingNamed(container, 'Folder')))
    suggest.selectSuggestion(folder, new MouseEvent('click'))
    await flushAsync()

    expect((await settingsStore.loadSettings()).annotationsFolder).toBe(
      'Study/Annotations',
    )
  })

  it('persists a file-suggester template pick', async () => {
    const { container, settingsStore, app } = await setup()
    const template = Object.assign(new TFile(), {
      path: 'Templates/annotation.md',
    })
    app.vault.getMarkdownFiles = () => [template]

    const suggest = suggestFor(inputOf(settingNamed(container, 'Template file')))
    suggest.selectSuggestion(template, new MouseEvent('click'))
    await flushAsync()

    expect((await settingsStore.loadSettings()).annotationTemplatePath).toBe(
      'Templates/annotation.md',
    )
  })
})

describe('ScriptureStudySettingTab cross-references section', () => {
  const folderSetting = (container: HTMLElement): HTMLElement =>
    settingNamedUnder(container, 'Cross-references', 'Folder')
  const templateSetting = (container: HTMLElement): HTMLElement =>
    settingNamedUnder(container, 'Cross-references', 'Template file')

  it('describes the folder as where new cross-reference notes are created', async () => {
    const { container } = await setup()

    expect(folderSetting(container).textContent).toContain(
      'Where new cross-reference notes are created.',
    )
  })

  it('persists a trimmed folder, falling back to the default when blanked', async () => {
    const { container, settingsStore } = await setup()

    changeInput(folderSetting(container), ' /PKM/Cross-References/ ')
    await flushAsync()
    expect((await settingsStore.loadSettings()).crossReferencesFolder).toBe(
      'PKM/Cross-References',
    )

    changeInput(folderSetting(container), '   ')
    await flushAsync()
    expect((await settingsStore.loadSettings()).crossReferencesFolder).toBe(
      'Cross-References',
    )
  })

  it('persists the template file, clearing it when blanked', async () => {
    const { container, settingsStore } = await setup()

    changeInput(templateSetting(container), 'Templates/Cross-reference.md')
    await flushAsync()
    expect(
      (await settingsStore.loadSettings()).crossReferenceTemplatePath,
    ).toBe('Templates/Cross-reference.md')

    changeInput(templateSetting(container), '')
    await flushAsync()
    expect(
      (await settingsStore.loadSettings()).crossReferenceTemplatePath,
    ).toBeNull()
  })
})

describe('ScriptureStudySettingTab highlights palette', () => {
  const colorPickersOf = (setting: HTMLElement): HTMLInputElement[] => [
    ...setting.querySelectorAll<HTMLInputElement>('input[type="color"]'),
  ]

  const slotRow = (container: HTMLElement, slot: number): HTMLElement =>
    settingNamed(container, `Slot ${slot}`)

  it('shows a row per Highlight Slot with a light and a dark picker', async () => {
    const { container } = await setup()

    for (const slot of [1, 2, 3, 4, 5]) {
      const pickers = colorPickersOf(slotRow(container, slot))
      expect(pickers).toHaveLength(2)
      expect(pickers[0]?.value).toBe(defaultHighlightPalette().light[slot - 1])
      expect(pickers[1]?.value).toBe(defaultHighlightPalette().dark[slot - 1])
    }
    expect(hasSettingNamed(container, 'Slot 6')).toBe(false)
  })

  it('persists a light-mode slot color', async () => {
    const { container, settingsStore } = await setup()

    const picker = colorPickersOf(slotRow(container, 2))[0]
    if (picker === undefined) throw new Error('no light picker')
    picker.value = '#123456'
    picker.dispatchEvent(new Event('change'))
    await flushAsync()

    const { highlightPalette } = await settingsStore.loadSettings()
    expect(highlightPalette.light[1]).toBe('#123456')
    expect(highlightPalette.dark).toEqual(defaultHighlightPalette().dark)
    expect(highlightPalette.light[0]).toBe(defaultHighlightPalette().light[0])
  })

  it('persists a dark-mode slot color', async () => {
    const { container, settingsStore } = await setup()

    const picker = colorPickersOf(slotRow(container, 5))[1]
    if (picker === undefined) throw new Error('no dark picker')
    picker.value = '#654321'
    picker.dispatchEvent(new Event('change'))
    await flushAsync()

    const { highlightPalette } = await settingsStore.loadSettings()
    expect(highlightPalette.dark[4]).toBe('#654321')
    expect(highlightPalette.light).toEqual(defaultHighlightPalette().light)
  })

  it('restores the shipped defaults and re-renders the pickers on reset', async () => {
    const { container, settingsStore } = await setup({
      storedSettings: {
        highlightPalette: {
          light: ['#111111', '#222222', '#333333', '#444444', '#555555'],
          dark: ['#666666', '#777777', '#888888', '#999999', '#aaaaaa'],
        },
      },
    })
    expect(colorPickersOf(slotRow(container, 1))[0]?.value).toBe('#111111')

    const reset = settingNamed(container, 'Reset highlights').querySelector(
      'button',
    )
    if (!(reset instanceof HTMLButtonElement)) throw new Error('no reset button')
    reset.click()
    await flushAsync()

    expect((await settingsStore.loadSettings()).highlightPalette).toEqual(
      defaultHighlightPalette(),
    )
    expect(colorPickersOf(slotRow(container, 1))[0]?.value).toBe(
      defaultHighlightPalette().light[0],
    )
  })

  it('falls back to the shipped color for a malformed stored slot', async () => {
    const { container } = await setup({
      storedSettings: { highlightPalette: { light: ['nonsense'] } as never },
    })

    expect(colorPickersOf(slotRow(container, 1))[0]?.value).toBe(
      defaultHighlightPalette().light[0],
    )
  })
})

describe('ScriptureStudySettingTab highlight wash', () => {
  const sliderOf = (setting: HTMLElement): HTMLInputElement => {
    const slider = setting.querySelector('input[type="range"]')
    if (!(slider instanceof HTMLInputElement)) throw new Error('no slider')
    return slider
  }

  const opacityRow = (
    container: HTMLElement,
    mode: 'light' | 'dark',
  ): HTMLElement => settingNamed(container, `Opacity (${mode} mode)`)

  const dragTo = (slider: HTMLInputElement, value: number): void => {
    slider.value = String(value)
    slider.dispatchEvent(new Event('input'))
  }

  it('renders an opacity slider per mode between Slot 5 and the reset row', async () => {
    const { container } = await setup()

    const names = settingItems(container).map(settingName)
    expect(names.indexOf('Slot 5')).toBeLessThan(
      names.indexOf('Opacity (light mode)'),
    )
    expect(names.indexOf('Opacity (light mode)')).toBeLessThan(
      names.indexOf('Opacity (dark mode)'),
    )
    expect(names.indexOf('Opacity (dark mode)')).toBeLessThan(
      names.indexOf('Reset highlights'),
    )

    const light = sliderOf(opacityRow(container, 'light'))
    expect([light.min, light.max, light.step]).toEqual(['5', '100', '1'])
    expect(light.value).toBe(String(defaultHighlightWash().light))
    expect(opacityRow(container, 'light').textContent).toContain(
      `${defaultHighlightWash().light}%`,
    )
    expect(opacityRow(container, 'dark').textContent).toContain(
      `${defaultHighlightWash().dark}%`,
    )
  })

  it('persists only the light wash when the light slider settles', async () => {
    const { container, settingsStore } = await setup()

    const slider = sliderOf(opacityRow(container, 'light'))
    slider.value = '70'
    slider.dispatchEvent(new Event('change'))
    await flushAsync()

    const settings = await settingsStore.loadSettings()
    expect(settings.highlightWash).toEqual({
      light: 70,
      dark: defaultHighlightWash().dark,
    })
    expect(settings.highlightPalette).toEqual(defaultHighlightPalette())
  })

  it('persists only the dark wash when the dark slider settles', async () => {
    const { container, settingsStore } = await setup()

    const slider = sliderOf(opacityRow(container, 'dark'))
    slider.value = '12'
    slider.dispatchEvent(new Event('change'))
    await flushAsync()

    expect((await settingsStore.loadSettings()).highlightWash).toEqual({
      light: defaultHighlightWash().light,
      dark: 12,
    })
  })

  it('relabels while dragged but persists only on release', async () => {
    const { container, settingsStore } = await setup()

    const slider = sliderOf(opacityRow(container, 'light'))
    dragTo(slider, 62)
    await flushAsync()

    expect(opacityRow(container, 'light').textContent).toContain('62%')
    expect((await settingsStore.loadSettings()).highlightWash.light).toBe(
      defaultHighlightWash().light,
    )

    slider.dispatchEvent(new Event('change'))
    await flushAsync()
    expect((await settingsStore.loadSettings()).highlightWash.light).toBe(62)
  })

  it('restores the shipped wash alongside the palette on reset', async () => {
    const { container, settingsStore } = await setup({
      storedSettings: { highlightWash: { light: 90, dark: 80 } },
    })
    expect(sliderOf(opacityRow(container, 'light')).value).toBe('90')

    const reset = settingNamed(container, 'Reset highlights').querySelector(
      'button',
    )
    if (!(reset instanceof HTMLButtonElement)) throw new Error('no reset button')
    reset.click()
    await flushAsync()

    const settings = await settingsStore.loadSettings()
    expect(settings.highlightWash).toEqual(defaultHighlightWash())
    expect(settings.highlightPalette).toEqual(defaultHighlightPalette())
    expect(sliderOf(opacityRow(container, 'light')).value).toBe(
      String(defaultHighlightWash().light),
    )
    expect(opacityRow(container, 'dark').textContent).toContain(
      `${defaultHighlightWash().dark}%`,
    )
  })
})

describe('ScriptureStudySettingTab re-render stability', () => {
  it('keeps the rendered DOM when a change leaves the structure unchanged', async () => {
    const { container, settingsStore } = await setup()

    const ordering = settingNamed(container, 'Display ordering')
    changeDropdown(ordering, 'path-a-z')
    await flushAsync()

    expect((await settingsStore.loadSettings()).annotationOrdering).toBe(
      'path-a-z',
    )
    expect(container.contains(ordering)).toBe(true)
  })

  it('rebuilds when a change alters the structure', async () => {
    const { container } = await setup(
      {
        availableTranslations: async () => [
          { id: 'web', name: 'World English Bible', language: 'English' },
          { id: 'aov', name: 'Ou Vertaling', language: 'Afrikaans' },
        ],
      },
      { page: 'Translations' },
    )
    expect(hasSettingNamed(container, 'Ou Vertaling')).toBe(false)

    changeDropdown(settingNamed(container, 'Language'), 'Afrikaans')
    await flushAsync()

    expect(hasSettingNamed(container, 'Ou Vertaling')).toBe(true)
  })
})

describe('ScriptureStudySettingTab unsaved text input', () => {
  it('keeps a focused text input and its unsaved value across background refreshes', async () => {
    const { container, model } = await setup()

    const input = inputOf(settingNamed(container, 'Folder'))
    input.focus()
    input.value = 'partially-typed'

    await model.refresh()

    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('partially-typed')
  })

  it('applies the deferred re-render once the input blurs', async () => {
    let manifests: ModuleManifest[] = []
    const { container, model } = await setup({
      installedManifests: async () => manifests,
    })

    const input = inputOf(settingNamed(container, 'Folder'))
    input.focus()
    manifests = [moduleManifest('web', 'World English Bible')]
    await model.refresh()
    expect(container.contains(input)).toBe(true)

    input.blur()

    expect(container.contains(input)).toBe(false)
    expect(hasSettingNamed(container, 'Folder')).toBe(true)
  })

  it('still re-renders immediately while a toggle has focus', async () => {
    let manifests: ModuleManifest[] = []
    const { container, model } = await setup({
      installedManifests: async () => manifests,
    })

    const toggle = toggleOf(settingNamed(container, "Enable Strong's"))
    toggle.focus()
    manifests = [moduleManifest('web', 'World English Bible')]
    await model.refresh()

    expect(container.contains(toggle)).toBe(false)
    expect(hasSettingNamed(container, "Enable Strong's")).toBe(true)
  })
})

const bookManifest = (): ModuleManifest => ({
  ...moduleManifest('hum-m1895', 'Humility'),
  kind: 'book',
  book: {
    number: 101,
    editionCode: 'HUM-M1895',
    author: 'Andrew Murray',
    year: 1895,
    abbreviation: 'Hum',
    sections: [{ chapter: 0, name: 'Preface', paragraphs: 4 }],
  },
})

// The Book's own row and its two device rows render as one block, so a
// Book's atom-numbers row is the one at the given offset after its row.
const atomNumbersSetting = (
  container: HTMLElement,
  book: string,
  device: 'desktop' | 'mobile',
): HTMLElement => {
  const items = settingItems(container)
  const row = items.indexOf(settingNamed(container, book))
  return items[row + (device === 'desktop' ? 1 : 2)]
}

const atomNumbersRow = (
  container: HTMLElement,
  book: string,
  device: 'desktop' | 'mobile',
): HTMLSelectElement => dropdownOf(atomNumbersSetting(container, book, device))

const bookManifestOf = (
  id: string,
  name: string,
  number: number,
  author: string,
  atom?: 'verse',
): ModuleManifest => ({
  ...moduleManifest(id, name),
  kind: 'book',
  book: {
    number,
    editionCode: id.toUpperCase(),
    author,
    year: 1900,
    abbreviation: name,
    ...(atom === undefined ? {} : { atom }),
    sections: [{ chapter: 1, name: '1', paragraphs: 1 }],
  },
})

const allBooksInstalled = () => ({
  storedSettings: { installedModuleIds: ['hum-m1895', 'in-at-e1', '1en-c1912'] },
  installedManifests: async () => [
    bookManifestOf('hum-m1895', 'Humility', 101, 'Andrew Murray'),
    bookManifestOf('in-at-e1', 'IN', 102, 'A Team'),
    bookManifestOf('1en-c1912', '1 Enoch', 103, 'Enoch', 'verse'),
  ],
})

describe('ScriptureStudySettingTab books section', () => {
  it('lists the book beside its author with the edition code', async () => {
    const { container } = await setup({}, { page: 'Books' })

    const row = settingNamed(container, 'Humility — Andrew Murray')
    expect(row.querySelector('.setting-item-description')?.textContent).toBe(
      'HUM-M1895',
    )
  })

  it('offers no language filter and no Strong\'s badge', async () => {
    const { container } = await setup(
      { installedManifests: async () => [bookManifest()] },
      { page: 'Books' },
    )

    expect(hasSettingNamed(container, 'Language')).toBe(false)
    expect(container.querySelector('.scripture-study-strongs-badge')).toBeNull()
  })

  it('downloads the book from the row button, showing progress', async () => {
    let resolveDownload: () => void = () => {}
    const downloadModule = vi.fn(
      () => new Promise<void>((resolve) => (resolveDownload = resolve)),
    )
    const { container } = await setup({ downloadModule }, { page: 'Books' })

    const button = settingNamed(container, 'Humility').querySelector('button')
    expect(button?.textContent).toBe('Download')

    button?.click()

    expect(
      settingNamed(container, 'Humility').querySelector('button')?.textContent,
    ).toBe('Downloading…')
    expect(downloadModule).toHaveBeenCalledWith('hum-m1895')

    resolveDownload()
    await flushAsync()
  })

  it('offers Update and Delete on an installed book with an update', async () => {
    const deleteModule = vi.fn(async () => {})
    const { container } = await setup(
      {
        storedSettings: { installedModuleIds: ['hum-m1895'] },
        installedManifests: async () => [bookManifest()],
        modulesWithUpdates: async () => ['hum-m1895'],
        deleteModule,
      },
      { page: 'Books' },
    )

    const buttons = [
      ...settingNamed(container, 'Humility').querySelectorAll('button'),
    ]
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Update',
      'Delete',
    ])

    buttons[1].click()
    await flushAsync()

    expect(deleteModule).toHaveBeenCalledWith('hum-m1895')
  })

  it('surfaces a failed book download on its row', async () => {
    const { container } = await setup(
      {
        downloadModule: vi.fn(async () => {
          throw new Error('release not published')
        }),
      },
      { page: 'Books' },
    )

    settingNamed(container, 'Humility').querySelector('button')?.click()
    await flushAsync()

    expect(
      settingNamed(container, 'Humility').querySelector(
        '.scripture-study-settings-error',
      )?.textContent,
    ).toBe('release not published')
  })

  it('words and defaults each Book’s atom-numbers rows after its atom kind', async () => {
    const { container } = await setup(allBooksInstalled(), { page: 'Books' })

    const names = settingItems(container).map(settingName)
    expect(names).toEqual([
      'Humility — Andrew Murray',
      'Para numbers (desktop)',
      'Para numbers (mobile)',
      'IN — A Team',
      'Para numbers (desktop)',
      'Para numbers (mobile)',
      '1 Enoch — Enoch',
      'Verse numbers (desktop)',
      'Verse numbers (mobile)',
    ])
    expect(
      atomNumbersRow(container, '1 Enoch — Enoch', 'desktop').value,
    ).toBe('on')
    expect(
      atomNumbersRow(container, 'Humility — Andrew Murray', 'desktop').value,
    ).toBe('hover')
  })

  it('persists one Book’s atom numbers on one device, touching no other', async () => {
    const { container, settingsStore } = await setup(allBooksInstalled(), {
      page: 'Books',
    })

    changeDropdown(
      atomNumbersSetting(container, '1 Enoch — Enoch', 'desktop'),
      'hover',
    )
    await flushAsync()

    const settings = await settingsStore.loadSettings()
    expect(settings.bookAtomNumbers).toEqual({
      '1en-c1912': { desktop: 'hover', mobile: 'on' },
    })
  })

  // The value belongs to an installed Book (§5), so an uninstalled row is
  // the Download row alone.
  it('offers no atom-numbers rows for a Book that is not installed', async () => {
    const { container } = await setup({}, { page: 'Books' })

    expect(settingItems(container).map(settingName)).toEqual([
      'Humility — Andrew Murray',
      'IN — A Team',
      '1 Enoch — Enoch',
    ])
  })

  it('keeps the installed book out of the Translations list and both pickers', async () => {
    const { container } = await setup({
      storedSettings: { installedModuleIds: ['web', 'hum-m1895'] },
      installedManifests: async () => [
        moduleManifest('web', 'World English Bible'),
        bookManifest(),
      ],
    })

    const options = [
      ...dropdownOf(settingNamed(container, 'Default translation')).options,
    ].map((option) => option.value)
    expect(options).toEqual(['web'])
    expect(hasSettingNamed(container, 'Humility')).toBe(false)
  })
})

describe('ScriptureStudySettingTab LSJ section', () => {
  it('installs the LSJ Lexicon from its own toggle', async () => {
    const lsj = {
      isInstalled: async () => false,
      install: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    }
    const { container } = await setup({ lsj })

    changeToggle(settingNamed(container, 'Enable full LSJ lexicon'), true)
    await flushAsync()

    expect(lsj.install).toHaveBeenCalled()
  })

  it('names the STEPBible source and its licence on the setting', async () => {
    const { container } = await setup()

    expect(settingNamed(container, 'Enable full LSJ lexicon').textContent).toContain(
      'CC BY 4.0',
    )
  })

  it('surfaces a failed LSJ install on the setting', async () => {
    const { container } = await setup({
      lsj: {
        isInstalled: async () => false,
        install: vi.fn(async () => {
          throw new Error('network gone')
        }),
        remove: vi.fn(async () => {}),
      },
    })

    changeToggle(settingNamed(container, 'Enable full LSJ lexicon'), true)
    await flushAsync()

    expect(
      settingNamed(container, 'Enable full LSJ lexicon').querySelector(
        '.scripture-study-settings-error',
      )?.textContent,
    ).toBe('network gone')
  })
})

describe('ScriptureStudySettingTab supplied and Editorial-mark opacity', () => {
  const sliderOf = (setting: HTMLElement): HTMLInputElement => {
    const slider = setting.querySelector('input[type="range"]')
    if (!(slider instanceof HTMLInputElement)) throw new Error('no slider')
    return slider
  }

  it('renders both sliders in Reader defaults right after Strong’s mode, on the wash’s range, at 50 % and 30 %', async () => {
    const { container } = await setup()

    const names = settingItems(container).map(settingName)
    expect(names.indexOf("Strong's mode (mobile)") + 1).toBe(
      names.indexOf('Supplied words opacity'),
    )
    expect(names.indexOf('Supplied words opacity') + 1).toBe(
      names.indexOf('Editorial marks opacity'),
    )
    expect(names.indexOf('Editorial marks opacity')).toBeLessThan(names.indexOf('Text size'))
    expect(names.filter((name) => /^Reset/.test(name))).toEqual(['Reset highlights'])

    const supplied = sliderOf(settingNamed(container, 'Supplied words opacity'))
    const marks = sliderOf(settingNamed(container, 'Editorial marks opacity'))
    expect([supplied.min, supplied.max, supplied.step]).toEqual(['5', '100', '1'])
    expect([marks.min, marks.max, marks.step]).toEqual(['5', '100', '1'])
    expect(supplied.value).toBe('50')
    expect(marks.value).toBe('30')
  })

  it('persists the supplied opacity when its slider settles, and the marks slider leaves it untouched', async () => {
    const { container, settingsStore } = await setup()

    const supplied = sliderOf(settingNamed(container, 'Supplied words opacity'))
    supplied.value = '100'
    supplied.dispatchEvent(new Event('change'))
    await flushAsync()

    let settings = await settingsStore.loadSettings()
    expect(settings.suppliedOpacityPercent).toBe(100)
    expect(settings.marksOpacityPercent).toBe(30)

    const marks = sliderOf(settingNamed(container, 'Editorial marks opacity'))
    marks.value = '5'
    marks.dispatchEvent(new Event('change'))
    await flushAsync()

    settings = await settingsStore.loadSettings()
    expect(settings.suppliedOpacityPercent).toBe(100)
    expect(settings.marksOpacityPercent).toBe(5)
  })

  it('writes nothing while a slider is still being dragged', async () => {
    const { container, settingsStore } = await setup()

    const marks = sliderOf(settingNamed(container, 'Editorial marks opacity'))
    marks.value = '60'
    marks.dispatchEvent(new Event('input'))
    await flushAsync()

    expect((await settingsStore.loadSettings()).marksOpacityPercent).toBe(30)
  })

  it('shows the factory value for a stored value off the range', async () => {
    const { container } = await setup({
      storedSettings: { suppliedOpacityPercent: 0, marksOpacityPercent: 250 },
    })

    expect(sliderOf(settingNamed(container, 'Supplied words opacity')).value).toBe('50')
    expect(sliderOf(settingNamed(container, 'Editorial marks opacity')).value).toBe('30')
  })
})

describe('ScriptureStudySettingTab underline palette', () => {
  const colorPickersOf = (setting: HTMLElement): HTMLInputElement[] => [
    ...setting.querySelectorAll<HTMLInputElement>('input[type="color"]'),
  ]

  const underlineRow = (container: HTMLElement, slot: number): HTMLElement =>
    settingNamed(container, `Underline slot ${slot}`)

  const resetButton = (container: HTMLElement): HTMLButtonElement => {
    const reset = settingNamed(container, 'Reset highlights').querySelector(
      'button',
    )
    if (!(reset instanceof HTMLButtonElement)) throw new Error('no reset button')
    return reset
  }

  it('renders an Underline sub-heading after the wash sliders and before the reset', async () => {
    const { container } = await setup()

    const names = settingItems(container).map(settingName)
    expect(names.indexOf('Opacity (dark mode)')).toBeLessThan(
      names.indexOf('Underline'),
    )
    expect(names.indexOf('Underline')).toBeLessThan(
      names.indexOf('Underline slot 1'),
    )
    expect(names.indexOf('Underline slot 5')).toBeLessThan(
      names.indexOf('Reset highlights'),
    )
  })

  it('shows a row per Underline Slot with a light and a dark picker on the shipped hues', async () => {
    const { container } = await setup()

    for (const slot of [1, 2, 3, 4, 5]) {
      const pickers = colorPickersOf(underlineRow(container, slot))
      expect(pickers).toHaveLength(2)
      expect(pickers[0]?.value).toBe(defaultUnderlinePalette().light[slot - 1])
      expect(pickers[1]?.value).toBe(defaultUnderlinePalette().dark[slot - 1])
    }
    expect(hasSettingNamed(container, 'Underline slot 6')).toBe(false)
  })

  it('offers no opacity slider of its own — an underline is never washed', async () => {
    const { container } = await setup()

    expect(hasSettingNamed(container, 'Underline opacity')).toBe(false)
    expect(
      underlineRow(container, 1).querySelector('input[type="range"]'),
    ).toBeNull()
  })

  it('persists a light-mode underline colour without touching the highlight palette', async () => {
    const { container, settingsStore } = await setup()

    const picker = colorPickersOf(underlineRow(container, 2))[0]
    if (picker === undefined) throw new Error('no light picker')
    picker.value = '#123456'
    picker.dispatchEvent(new Event('change'))
    await flushAsync()

    const settings = await settingsStore.loadSettings()
    expect(settings.underlinePalette.light[1]).toBe('#123456')
    expect(settings.underlinePalette.dark).toEqual(
      defaultUnderlinePalette().dark,
    )
    expect(settings.highlightPalette).toEqual(defaultHighlightPalette())
  })

  it('persists a dark-mode underline colour', async () => {
    const { container, settingsStore } = await setup()

    const picker = colorPickersOf(underlineRow(container, 5))[1]
    if (picker === undefined) throw new Error('no dark picker')
    picker.value = '#654321'
    picker.dispatchEvent(new Event('change'))
    await flushAsync()

    const settings = await settingsStore.loadSettings()
    expect(settings.underlinePalette.dark[4]).toBe('#654321')
    expect(settings.underlinePalette.light).toEqual(
      defaultUnderlinePalette().light,
    )
  })

  it('restores the underline palette with the slots and the wash on reset', async () => {
    const { container, settingsStore } = await setup({
      storedSettings: {
        underlinePalette: {
          light: ['#111111', '#222222', '#333333', '#444444', '#555555'],
          dark: ['#666666', '#777777', '#888888', '#999999', '#aaaaaa'],
        },
        highlightWash: { light: 90, dark: 80 },
      },
    })
    expect(colorPickersOf(underlineRow(container, 1))[0]?.value).toBe('#111111')

    resetButton(container).click()
    await flushAsync()

    const settings = await settingsStore.loadSettings()
    expect(settings.underlinePalette).toEqual(defaultUnderlinePalette())
    expect(settings.highlightPalette).toEqual(defaultHighlightPalette())
    expect(settings.highlightWash).toEqual(defaultHighlightWash())
    expect(colorPickersOf(underlineRow(container, 1))[0]?.value).toBe(
      defaultUnderlinePalette().light[0],
    )
  })

  it('falls back to the shipped colour for a malformed stored underline slot', async () => {
    const { container } = await setup({
      storedSettings: { underlinePalette: { light: ['nonsense'] } as never },
    })

    expect(colorPickersOf(underlineRow(container, 1))[0]?.value).toBe(
      defaultUnderlinePalette().light[0],
    )
  })
})
