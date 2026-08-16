import { describe, expect, it } from 'vitest'
import { App, PluginSettingTab, type Plugin } from 'obsidian'
import { SettingsStore } from '../data-access'
import { ModulesFeature, ObsidianModuleDataDir } from '../modules'
import { StrongsDictionaries } from '../strongs'
import { SettingsFeature } from './settings-feature'

describe('SettingsFeature', () => {
  it('registers the settings tab on load', async () => {
    const registered: PluginSettingTab[] = []
    const plugin = {
      app: new App(),
      loadData: async () => null,
      saveData: async () => {},
      addSettingTab: (tab: PluginSettingTab) => registered.push(tab),
    } as unknown as Plugin
    const settingsStore = new SettingsStore(plugin)
    const modules = new ModulesFeature(plugin, settingsStore)
    const strongs = new StrongsDictionaries(
      new ObsidianModuleDataDir(plugin),
      { fetchHebrew: async () => '', fetchGreek: async () => '' },
      settingsStore,
    )
    const feature = new SettingsFeature(plugin, settingsStore, modules, strongs)

    await feature.load()

    expect(registered).toHaveLength(1)
    expect(registered[0]).toBeInstanceOf(PluginSettingTab)
  })
})
