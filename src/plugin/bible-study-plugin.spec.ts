import { describe, expect, it, vi } from 'vitest'
import { App, type PluginManifest } from 'obsidian'
import BibleStudyPlugin from './bible-study-plugin'

const manifest: PluginManifest = {
  id: 'bible-study',
  name: 'Bible Study',
  version: '0.0.1',
  minAppVersion: '1.0.0',
  description: '',
  author: '',
}

const pluginWithStorage = (): BibleStudyPlugin => {
  const plugin = new BibleStudyPlugin(new App(), manifest)
  let data: unknown = null
  plugin.loadData = async () => data
  plugin.saveData = async (value: unknown) => {
    data = value
  }
  return plugin
}

describe('BibleStudyPlugin same-device settings changes', () => {
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
})
