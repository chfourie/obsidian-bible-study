import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../data-access'
import { renderContextFromSettings } from './render-context'

describe('renderContextFromSettings', () => {
  it('knows installed modules and the well-known translation ids', () => {
    const context = renderContextFromSettings({
      ...DEFAULT_SETTINGS,
      installedModuleIds: ['web', 'custom'],
    })

    expect(context.knownTranslationIds).toContain('custom')
    expect(context.knownTranslationIds).toContain('web')
    expect(context.knownTranslationIds).toContain('nkjv')
    expect(new Set(context.knownTranslationIds).size).toBe(
      context.knownTranslationIds.length,
    )
  })

  it('uses the configured default translation', () => {
    const context = renderContextFromSettings({
      ...DEFAULT_SETTINGS,
      installedModuleIds: ['web', 'kjv'],
      defaultTranslationId: 'kjv',
    })

    expect(context.defaultTranslationId).toBe('kjv')
  })

  it('falls back to the first installed module when no default is set', () => {
    const context = renderContextFromSettings({
      ...DEFAULT_SETTINGS,
      installedModuleIds: ['kjv', 'web'],
    })

    expect(context.defaultTranslationId).toBe('kjv')
  })

  it('has no default translation when nothing is installed', () => {
    expect(renderContextFromSettings(DEFAULT_SETTINGS).defaultTranslationId).toBeNull()
  })

  it('has no default translation when only non-translation modules are installed', () => {
    const context = renderContextFromSettings({
      ...DEFAULT_SETTINGS,
      installedModuleIds: ['strongs-dictionaries'],
    })

    expect(context.defaultTranslationId).toBeNull()
  })

  it('skips non-translation modules when falling back to the first installed', () => {
    const context = renderContextFromSettings({
      ...DEFAULT_SETTINGS,
      installedModuleIds: ['strongs-dictionaries', 'web'],
    })

    expect(context.defaultTranslationId).toBe('web')
    expect(context.knownTranslationIds).not.toContain('strongs-dictionaries')
  })
})
