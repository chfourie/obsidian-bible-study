import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './scripture-study-settings.type'
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

  it('defaults the annotation settings per the v1 spec', async () => {
    const { store } = setup()

    const settings = await store.loadSettings()

    expect(settings.annotationsFolder).toBe('Annotations')
    expect(settings.annotationTemplatePath).toBe(null)
    expect(settings.annotationOrdering).toBe('created-oldest-first')
  })

  it('merges stored data over defaults', async () => {
    const { store } = setup({ installedModuleIds: ['web'] })

    expect(await store.loadSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      installedModuleIds: ['web'],
      defaultTranslationId: 'web',
      fallbackTranslationId: 'web',
    })
  })

  it('silently drops the removed online-tier fields on load', async () => {
    const { store } = setup({
      installedModuleIds: ['web'],
      apiBibleKey: 'key-123',
      enabledOnlineTranslationIds: ['nkjv'],
    })

    const settings = await store.loadSettings()

    expect(settings).toEqual({
      ...DEFAULT_SETTINGS,
      installedModuleIds: ['web'],
      defaultTranslationId: 'web',
      fallbackTranslationId: 'web',
    })
    expect('apiBibleKey' in settings).toBe(false)
    expect('enabledOnlineTranslationIds' in settings).toBe(false)
  })

  it('bootstraps a legacy online-only default translation on load', async () => {
    const { store } = setup({
      installedModuleIds: ['web'],
      defaultTranslationId: 'nkjv',
      fallbackTranslationId: 'nkjv',
    })

    const settings = await store.loadSettings()

    expect(settings.defaultTranslationId).toBe('web')
    expect(settings.fallbackTranslationId).toBe('web')
  })

  it('keeps a stored default that names an installed module on load', async () => {
    const { store } = setup({
      installedModuleIds: ['web', 'bsb'],
      defaultTranslationId: 'bsb',
      fallbackTranslationId: 'bsb',
    })

    const settings = await store.loadSettings()

    expect(settings.defaultTranslationId).toBe('bsb')
    expect(settings.fallbackTranslationId).toBe('bsb')
  })

  it('drops the removed fields from the persisted data on the next update', async () => {
    const { store, data } = setup({
      installedModuleIds: ['web'],
      apiBibleKey: 'key-123',
      enabledOnlineTranslationIds: ['nkjv'],
    })

    await store.updateSettings((settings) => settings)

    expect(data()).not.toHaveProperty('apiBibleKey')
    expect(data()).not.toHaveProperty('enabledOnlineTranslationIds')
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

  it('notifies listeners with the settings each update persists', async () => {
    const { store } = setup()
    const seen: unknown[] = []
    store.onSettingsChanged((settings) => seen.push(settings))

    const updated = await store.updateSettings((settings) => ({
      ...settings,
      installedModuleIds: ['web'],
    }))

    expect(seen).toEqual([updated])
  })

  it('bootstraps the default and fallback translations on every update', async () => {
    const { store } = setup()

    const updated = await store.updateSettings((settings) => ({
      ...settings,
      installedModuleIds: ['web'],
    }))

    expect(updated.defaultTranslationId).toBe('web')
    expect(updated.fallbackTranslationId).toBe('web')
  })

  it('unsets the translation pickers when the last module is deleted', async () => {
    const { store } = setup({
      installedModuleIds: ['web'],
      defaultTranslationId: 'web',
      fallbackTranslationId: 'web',
    })

    const updated = await store.updateSettings((settings) => ({
      ...settings,
      installedModuleIds: [],
    }))

    expect(updated.defaultTranslationId).toBe(null)
    expect(updated.fallbackTranslationId).toBe(null)
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
