import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './scripture-study-settings.type'
import { applyTranslationBootstrap } from './bootstrap-translations'

describe('applyTranslationBootstrap', () => {
  it('auto-sets default and fallback to the first module when one appears', () => {
    const settings = applyTranslationBootstrap({
      ...DEFAULT_SETTINGS,
      installedModuleIds: ['web'],
    })

    expect(settings.defaultTranslationId).toBe('web')
    expect(settings.fallbackTranslationId).toBe('web')
  })

  it('keeps explicit choices that are still candidates', () => {
    const settings = applyTranslationBootstrap({
      ...DEFAULT_SETTINGS,
      installedModuleIds: ['web', 'bsb'],
      defaultTranslationId: 'bsb',
      fallbackTranslationId: 'bsb',
    })

    expect(settings.defaultTranslationId).toBe('bsb')
    expect(settings.fallbackTranslationId).toBe('bsb')
  })

  it('reassigns to the first remaining module on deletion', () => {
    const settings = applyTranslationBootstrap({
      ...DEFAULT_SETTINGS,
      installedModuleIds: ['bsb'],
      defaultTranslationId: 'web',
      fallbackTranslationId: 'web',
    })

    expect(settings.defaultTranslationId).toBe('bsb')
    expect(settings.fallbackTranslationId).toBe('bsb')
  })

  it('unsets both when the last translation disappears', () => {
    const settings = applyTranslationBootstrap({
      ...DEFAULT_SETTINGS,
      installedModuleIds: [],
      defaultTranslationId: 'web',
      fallbackTranslationId: 'web',
    })

    expect(settings.defaultTranslationId).toBe(null)
    expect(settings.fallbackTranslationId).toBe(null)
  })

  it('never counts the Strongs Dictionaries module as a translation', () => {
    const settings = applyTranslationBootstrap({
      ...DEFAULT_SETTINGS,
      installedModuleIds: ['strongs-dictionaries'],
    })

    expect(settings.defaultTranslationId).toBe(null)
    expect(settings.fallbackTranslationId).toBe(null)
  })

  it('drops a legacy online default that no installed module backs', () => {
    const settings = applyTranslationBootstrap({
      ...DEFAULT_SETTINGS,
      installedModuleIds: [],
      defaultTranslationId: 'nkjv',
    })

    expect(settings.defaultTranslationId).toBe(null)
  })
})
