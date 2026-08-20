import { beforeEach, describe, expect, it } from 'vitest'
import { App, PluginSettingTab, type Plugin } from 'obsidian'
import {
  DEFAULT_SETTINGS,
  SettingsStore,
  type ScriptureStudySettings,
} from '../data-access'
import { ModulesFeature, ObsidianModuleDataDir } from '../modules'
import { LsjLexicon, StrongsDictionaries } from '../strongs'
import { SettingsFeature } from './settings-feature'


const setup = () => {
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
    {
      fetchHebrew: async () => '',
      fetchGreek: async () => '',
      fetchHebrewDerivations: async () => '',
      fetchGreekDerivations: async () => '',
    },
    settingsStore,
  )
  const lsj = new LsjLexicon(
    new ObsidianModuleDataDir(plugin),
    { fetchLsj: async () => [] },
    settingsStore,
  )
  const feature = new SettingsFeature(
    plugin,
    settingsStore,
    modules,
    strongs,
    lsj,
  )
  return { feature, registered }
}

const paletteVariable = (name: string): string =>
  document.body.style.getPropertyValue(name)

const settingsWithPalette = (light: string[]): ScriptureStudySettings => ({
  ...DEFAULT_SETTINGS,
  highlightPalette: { ...DEFAULT_SETTINGS.highlightPalette, light },
})

describe('SettingsFeature', () => {
  beforeEach(() => document.body.removeAttribute('style'))

  it('registers the settings tab on load', async () => {
    const { feature, registered } = setup()

    await feature.load()

    expect(registered).toHaveLength(1)
    expect(registered[0]).toBeInstanceOf(PluginSettingTab)
  })

  it('emits the configured highlight palette as CSS variables on load', async () => {
    const { feature } = setup()
    feature.useSettings(
      settingsWithPalette(['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000']),
    )

    await feature.load()

    expect(paletteVariable('--ss-hl-light-1')).toBe('rgba(255, 0, 0, 0.45)')
  })

  it('re-emits the variables when the palette changes', async () => {
    const { feature } = setup()
    await feature.load()

    feature.useSettings(
      settingsWithPalette(['#123456', '#00ff00', '#0000ff', '#ffffff', '#000000']),
    )
    feature.onSettingsChanged()

    expect(paletteVariable('--ss-hl-light-1')).toBe('rgba(18, 52, 86, 0.45)')
  })

  it('removes the emitted variables on unload', async () => {
    const { feature } = setup()
    await feature.load()

    feature.unload()

    expect(paletteVariable('--ss-hl-light-1')).toBe('')
    expect(paletteVariable('--ss-hl-dark-5')).toBe('')
  })
})
