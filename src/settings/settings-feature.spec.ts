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

const settingsWithWash = (wash: unknown): ScriptureStudySettings =>
  ({ ...DEFAULT_SETTINGS, highlightWash: wash }) as ScriptureStudySettings

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

  it('emits the stored highlight wash as the variable alpha on load', async () => {
    const { feature } = setup()
    feature.useSettings(settingsWithWash({ light: 70, dark: 8 }))

    await feature.load()

    expect(paletteVariable('--ss-hl-light-1')).toContain('0.7)')
    expect(paletteVariable('--ss-hl-dark-1')).toContain('0.08)')
  })

  it('re-emits the variables when the wash changes', async () => {
    const { feature } = setup()
    await feature.load()

    feature.useSettings(settingsWithWash({ light: 12, dark: 90 }))
    feature.onSettingsChanged()

    expect(paletteVariable('--ss-hl-light-1')).toContain('0.12)')
    expect(paletteVariable('--ss-hl-dark-1')).toContain('0.9)')
  })

  it('falls back to the shipped wash when nothing is stored', async () => {
    const { feature } = setup()
    feature.useSettings(settingsWithWash(undefined))

    await feature.load()

    expect(paletteVariable('--ss-hl-light-1')).toContain('0.45)')
    expect(paletteVariable('--ss-hl-dark-1')).toContain('0.26)')
  })

  it('emits the factory supplied and mark opacities on load — BSB’s supplied words dim to 50 %', async () => {
    const { feature } = setup()
    feature.useSettings(DEFAULT_SETTINGS)

    await feature.load()

    expect(paletteVariable('--ss-supplied-opacity')).toBe('0.5')
    expect(paletteVariable('--ss-marks-opacity')).toBe('0.3')
  })

  it('re-emits the opacities when either changes, each on its own', async () => {
    const { feature } = setup()
    await feature.load()

    feature.useSettings({ ...DEFAULT_SETTINGS, suppliedOpacityPercent: 100 })
    feature.onSettingsChanged()
    expect(paletteVariable('--ss-supplied-opacity')).toBe('1')
    expect(paletteVariable('--ss-marks-opacity')).toBe('0.3')

    feature.useSettings({ ...DEFAULT_SETTINGS, marksOpacityPercent: 60 })
    feature.onSettingsChanged()
    expect(paletteVariable('--ss-supplied-opacity')).toBe('0.5')
    expect(paletteVariable('--ss-marks-opacity')).toBe('0.6')
  })

  it('removes the opacity variables on unload', async () => {
    const { feature } = setup()
    await feature.load()

    feature.unload()

    expect(paletteVariable('--ss-supplied-opacity')).toBe('')
    expect(paletteVariable('--ss-marks-opacity')).toBe('')
  })

  it('removes the emitted variables on unload', async () => {
    const { feature } = setup()
    await feature.load()

    feature.unload()

    expect(paletteVariable('--ss-hl-light-1')).toBe('')
    expect(paletteVariable('--ss-hl-dark-5')).toBe('')
  })
})
