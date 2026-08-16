import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Plugin as ObsidianPlugin } from 'obsidian'
import {
  AbstractInputSuggest,
  App,
  Plugin,
  TFile,
  TFolder,
} from '../../tests/mocks/obsidian'
import { SettingsStore, type ScriptureStudySettings } from '../data-access'
import type { ModuleManifest } from '../modules'
import { ScriptureStudySettingTab } from './settings-tab'
import { SettingsTabModel, type SettingsTabDeps } from './settings-tab-model'

const moduleManifest = (
  id: string,
  name = id.toUpperCase(),
  tagged = false,
): ModuleManifest => ({
  id,
  name,
  language: 'English',
  license: 'Public Domain',
  source: 'test',
  sourceChecksum: '',
  formatVersion: 1,
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
  storedSettings?: Partial<ScriptureStudySettings>
}

const flushAsync = () => new Promise((resolve) => window.setTimeout(resolve, 0))

const setup = async (overrides: SetupOverrides = {}) => {
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
  const app = new App()
  const plugin = new Plugin(app, pluginManifest) as unknown as ObsidianPlugin
  const tab = new ScriptureStudySettingTab(plugin, model)
  document.body.appendChild(tab.containerEl)
  // Structural cast: the base class deprecates display() in favor of the
  // declarative settings API, but Obsidian still opens imperative tabs
  // through it.
  ;(tab as { display(): void }).display()
  await flushAsync()
  return { tab, model, settingsStore, app, container: tab.containerEl }
}

const settingItems = (container: HTMLElement): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>('.setting-item'),
]

const settingName = (item: HTMLElement): string =>
  item.querySelector('.setting-item-name')?.textContent ?? ''

const settingNamed = (container: HTMLElement, name: string): HTMLElement => {
  const found = settingItems(container).find((item) =>
    settingName(item).startsWith(name),
  )
  if (!found) throw new Error(`no setting named ${name}`)
  return found
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
  it('masks the API key input and persists it on change', async () => {
    const { container, settingsStore } = await setup()

    const input = inputOf(settingNamed(container, 'API.Bible key'))
    expect(input.type).toBe('password')

    input.value = '  key-123  '
    input.dispatchEvent(new Event('change'))
    await flushAsync()

    expect((await settingsStore.loadSettings()).apiBibleKey).toBe('key-123')
  })

  it('offers catalog languages plus the persisted filter, and persists changes', async () => {
    const { container, settingsStore } = await setup({
      storedSettings: { languageFilter: 'Zulu' },
      availableTranslations: async () => [
        { id: 'web', name: 'World English Bible', language: 'English' },
        { id: 'aov', name: 'Ou Vertaling', language: 'Afrikaans' },
      ],
    })

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
    })

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
    })

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
    })

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

  it('hides the online tier without an API key', async () => {
    const { container } = await setup()

    expect(hasSettingNamed(container, 'Online — requires key')).toBe(false)
    expect(hasSettingNamed(container, 'New King James Version')).toBe(false)
  })

  it('wires cache-clear and the enable toggle on online rows', async () => {
    const clearPassageCache = vi.fn(async () => {})
    const { container, settingsStore } = await setup({
      storedSettings: { apiBibleKey: 'key-123' },
      clearPassageCache,
    })

    expect(hasSettingNamed(container, 'Online — requires key')).toBe(true)
    const row = settingNamed(container, 'New King James Version')
    expect(
      row.querySelector('.setting-item-description')?.textContent,
    ).toContain('14 days')

    row.querySelector<HTMLButtonElement>('button[data-icon="eraser"]')?.click()
    await flushAsync()
    expect(clearPassageCache).toHaveBeenCalledWith('nkjv')

    changeToggle(settingNamed(container, 'New King James Version'), true)
    await flushAsync()

    expect(
      (await settingsStore.loadSettings()).enabledOnlineTranslationIds,
    ).toEqual(['nkjv'])
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

describe('ScriptureStudySettingTab reader defaults', () => {
  it('persists a reader default change', async () => {
    const { container, settingsStore } = await setup()

    const navigation = settingNamed(container, 'Navigation')
    expect(dropdownOf(navigation).value).toBe('tree')

    changeDropdown(navigation, 'breadcrumb')
    await flushAsync()

    expect((await settingsStore.loadSettings()).readerNavDefault).toBe(
      'breadcrumb',
    )
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

  type SuggestUnderTest = {
    getSuggestions(query: string): (TFile | TFolder)[]
    renderSuggestion(value: TFile | TFolder, el: HTMLElement): void
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
    return suggest as unknown as SuggestUnderTest
  }

  it('suggests matching vault folders and persists a pick', async () => {
    const { container, settingsStore, app } = await setup()
    const folder = Object.assign(new TFolder(), { path: 'Study/Annotations' })
    const other = Object.assign(new TFolder(), { path: 'Daily' })
    app.vault.getAllFolders = () => [folder, other]

    const suggest = suggestFor(inputOf(settingNamed(container, 'Folder')))
    expect(suggest.getSuggestions('study')).toEqual([folder])

    const rendered = document.createElement('div')
    suggest.renderSuggestion(folder, rendered)
    expect(rendered.textContent).toBe('Study/Annotations')

    suggest.selectSuggestion(folder, new MouseEvent('click'))
    await flushAsync()

    expect((await settingsStore.loadSettings()).annotationsFolder).toBe(
      'Study/Annotations',
    )
  })

  it('suggests matching markdown files and persists a template pick', async () => {
    const { container, settingsStore, app } = await setup()
    const template = Object.assign(new TFile(), {
      path: 'Templates/annotation.md',
    })
    const other = Object.assign(new TFile(), { path: 'Daily/today.md' })
    app.vault.getMarkdownFiles = () => [template, other]

    const suggest = suggestFor(inputOf(settingNamed(container, 'Template file')))
    expect(suggest.getSuggestions('templates')).toEqual([template])

    suggest.selectSuggestion(template, new MouseEvent('click'))
    await flushAsync()

    expect((await settingsStore.loadSettings()).annotationTemplatePath).toBe(
      'Templates/annotation.md',
    )
  })
})

describe('ScriptureStudySettingTab unsaved text input', () => {
  it('keeps a focused text input and its unsaved value across background refreshes', async () => {
    const { container, model } = await setup()

    const input = inputOf(settingNamed(container, 'API.Bible key'))
    input.focus()
    input.value = 'partially-typed'

    await model.refresh()

    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('partially-typed')
  })

  it('applies the deferred re-render once the input blurs', async () => {
    const { container, model } = await setup()

    const input = inputOf(settingNamed(container, 'Folder'))
    input.focus()
    await model.refresh()
    expect(container.contains(input)).toBe(true)

    input.blur()

    expect(container.contains(input)).toBe(false)
    expect(hasSettingNamed(container, 'Folder')).toBe(true)
  })

  it('still re-renders immediately while a toggle has focus', async () => {
    const { container, model } = await setup()

    const toggle = toggleOf(settingNamed(container, "Enable Strong's"))
    toggle.focus()
    await model.refresh()

    expect(container.contains(toggle)).toBe(false)
    expect(hasSettingNamed(container, "Enable Strong's")).toBe(true)
  })
})
