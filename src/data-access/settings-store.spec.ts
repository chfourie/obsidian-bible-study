import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './bible-study-settings.type'
import { SettingsStore } from './settings-store'

const setup = (initialData: unknown = null) => {
  let data = initialData
  const store = new SettingsStore({
    loadData: async () => data,
    saveData: async (value) => {
      data = value
    },
  })
  return { store, data: () => data }
}

describe('SettingsStore', () => {
  it('returns defaults when nothing is stored', async () => {
    const { store } = setup()

    expect(await store.loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('merges stored data over defaults', async () => {
    const { store } = setup({ installedModuleIds: ['web'] })

    expect(await store.loadSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      installedModuleIds: ['web'],
    })
  })

  it('persists and returns the updated settings', async () => {
    const { store, data } = setup()

    const updated = await store.updateSettings((settings) => ({
      ...settings,
      installedModuleIds: ['web'],
    }))

    expect(updated.installedModuleIds).toEqual(['web'])
    expect(data()).toEqual(updated)
    expect(await store.loadSettings()).toEqual(updated)
  })

  it('applies updates on top of the latest stored data', async () => {
    const { store } = setup({ installedModuleIds: ['web'] })

    const updated = await store.updateSettings((settings) => ({
      ...settings,
      installedModuleIds: [...settings.installedModuleIds, 'bsb'],
    }))

    expect(updated.installedModuleIds).toEqual(['web', 'bsb'])
  })
})
