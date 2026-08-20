import { afterEach, describe, expect, it, vi } from 'vitest'
import { App, type PluginManifest } from 'obsidian'
import type { ModuleManifest } from '../modules'
import {
  chapterCount,
  deregisterBookVersification,
  isValidVerseId,
  makeVerseId,
} from '../reference'
import ScriptureStudyPlugin from './scripture-study-plugin'

const manifest: PluginManifest = {
  id: 'scripture-study',
  name: 'Scripture Study',
  version: '0.0.1',
  minAppVersion: '1.0.0',
  description: '',
  author: '',
}

const pluginWithStorage = (): ScriptureStudyPlugin => {
  const plugin = new ScriptureStudyPlugin(new App(), manifest)
  let data: unknown = null
  plugin.loadData = async () => data
  plugin.saveData = async (value: unknown) => {
    data = value
  }
  return plugin
}

describe('ScriptureStudyPlugin same-device settings changes', () => {
  it('propagates settings written in-session to every feature', async () => {
    const plugin = pluginWithStorage()
    const useSettings = vi.spyOn(plugin.rendering, 'useSettings')
    const onSettingsChanged = vi
      .spyOn(plugin.rendering, 'onSettingsChanged')
      .mockImplementation(() => {})

    await plugin.settingsStore.updateSettings((settings) => ({
      ...settings,
      installedModuleIds: ['web'],
    }))

    expect(useSettings).toHaveBeenCalledWith(
      expect.objectContaining({ installedModuleIds: ['web'] }),
    )
    expect(onSettingsChanged).toHaveBeenCalledTimes(1)
  })

  it('shares its settings store with the modules feature', () => {
    const plugin = pluginWithStorage()

    expect(plugin.modules.settingsStore).toBe(plugin.settingsStore)
  })

  it('propagates settings changes to the reader feature', async () => {
    const plugin = pluginWithStorage()
    const useSettings = vi.spyOn(plugin.reader, 'useSettings')

    await plugin.settingsStore.updateSettings((settings) => ({
      ...settings,
      readerNavDefault: { desktop: 'breadcrumb', mobile: 'tree' },
    }))

    expect(useSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        readerNavDefault: { desktop: 'breadcrumb', mobile: 'tree' },
      }),
    )
  })

  it('routes rendered-reference navigation to the reader feature', () => {
    const plugin = pluginWithStorage()

    expect(plugin.rendering.navigator).toBe(plugin.reader)
  })

  it('propagates settings changes to the annotations feature', async () => {
    const plugin = pluginWithStorage()
    const useSettings = vi.spyOn(plugin.annotations, 'useSettings')

    await plugin.settingsStore.updateSettings((settings) => ({
      ...settings,
      annotationsFolder: 'Bible/Notes',
    }))

    expect(useSettings).toHaveBeenCalledWith(
      expect.objectContaining({ annotationsFolder: 'Bible/Notes' }),
    )
  })

  it('downloads only the suggested BSB translation for the first-run nudge, not the Strong\'s dictionaries', async () => {
    const plugin = pluginWithStorage()
    const installDictionaries = vi.spyOn(plugin.strongsDictionaries, 'install')
    const download = vi
      .spyOn(plugin.modules.manager, 'downloadModule')
      .mockResolvedValue({
        id: 'bsb',
        name: 'Berean Standard Bible',
        language: 'English',
        license: 'Public Domain',
        source: 'test',
        sourceChecksum: '',
        formatVersion: 1,
        capabilities: { strongsTagged: true },
      })

    await plugin.installSuggestedTranslation()

    expect(download).toHaveBeenCalledWith('bsb')
    expect(installDictionaries).not.toHaveBeenCalled()
  })

  it('prefills new annotations from the open reader', () => {
    const plugin = pluginWithStorage()
    const prefillReference = vi
      .spyOn(plugin.reader, 'prefillReference')
      .mockReturnValue(null)

    plugin.annotations.prefillRefText()

    expect(prefillReference).toHaveBeenCalled()
  })
})

const HUMILITY_BOOK = 101

const humilityManifest: ModuleManifest = {
  id: 'hum-m1895',
  name: 'Humility',
  language: 'English',
  license: 'Public Domain',
  source: 'test',
  sourceChecksum: 'sha-hum-1',
  formatVersion: 2,
  kind: 'book',
  capabilities: { strongsTagged: false },
  book: {
    number: HUMILITY_BOOK,
    editionCode: 'HUM-M1895',
    author: 'Andrew Murray',
    year: 1895,
    abbreviation: 'Hum',
    sections: [
      { chapter: 0, name: 'Preface', paragraphs: 4 },
      { chapter: 1, name: 'The Glory of the Creature', paragraphs: 9 },
    ],
  },
}

describe('ScriptureStudyPlugin book module wiring', () => {
  afterEach(() => deregisterBookVersification(HUMILITY_BOOK))

  it('registers the versification of every installed book at load', async () => {
    const plugin = pluginWithStorage()
    vi.spyOn(plugin.modules.store, 'installedManifests').mockResolvedValue([
      humilityManifest,
    ])

    await plugin.modules.load()

    expect(chapterCount(HUMILITY_BOOK)).toBe(2)
    expect(isValidVerseId(makeVerseId(HUMILITY_BOOK, 1, 9))).toBe(true)
  })

  it('survives a malformed section table instead of failing plugin load', async () => {
    const plugin = pluginWithStorage()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(plugin.modules.store, 'installedManifests').mockResolvedValue([
      { ...humilityManifest, book: { ...humilityManifest.book!, sections: [] } },
    ])

    await expect(plugin.modules.load()).resolves.toBeUndefined()
    expect(chapterCount(HUMILITY_BOOK)).toBe(0)
  })

  it('deregisters the book and reindexes the vault on uninstall', async () => {
    const plugin = pluginWithStorage()
    vi.spyOn(plugin.modules.store, 'installedManifests').mockResolvedValue([
      humilityManifest,
    ])
    vi.spyOn(plugin.modules.store, 'manifest').mockResolvedValue(
      humilityManifest,
    )
    vi.spyOn(plugin.modules.store, 'deleteModule').mockResolvedValue()
    const reindex = vi
      .spyOn(plugin.vaultIndex, 'reindexVault')
      .mockResolvedValue()
    await plugin.modules.load()

    await plugin.modules.manager.deleteModule('hum-m1895')

    expect(chapterCount(HUMILITY_BOOK)).toBe(0)
    expect(reindex).toHaveBeenCalled()
  })
})
