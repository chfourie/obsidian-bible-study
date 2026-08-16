import { describe, expect, it, vi } from 'vitest'
import { App, type PluginManifest } from 'obsidian'
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
      readerNavDefault: 'breadcrumb',
    }))

    expect(useSettings).toHaveBeenCalledWith(
      expect.objectContaining({ readerNavDefault: 'breadcrumb' }),
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

  it('routes annotate-from-reader to the annotations feature', () => {
    const plugin = pluginWithStorage()
    const annotate = vi
      .spyOn(plugin.annotations, 'annotate')
      .mockResolvedValue()
    const reference = { book: 43, ranges: [{ startId: 43015004, endId: 43015004 }] }

    plugin.reader.annotateReference(reference)

    expect(annotate).toHaveBeenCalledWith(reference)
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
