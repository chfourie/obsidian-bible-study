import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../data-access'
import {
  enabledOnlineTranslations,
  ONLINE_TRANSLATIONS,
} from './online-translation-catalog'

const settingsWith = (overrides: Partial<typeof DEFAULT_SETTINGS>) => ({
  ...DEFAULT_SETTINGS,
  ...overrides,
})

describe('enabledOnlineTranslations', () => {
  it('returns nothing without an API key', () => {
    const settings = settingsWith({
      apiBibleKey: null,
      enabledOnlineTranslationIds: ['nkjv'],
    })
    expect(enabledOnlineTranslations(settings)).toEqual([])
  })

  it('returns nothing when no online translation is enabled', () => {
    const settings = settingsWith({
      apiBibleKey: 'key',
      enabledOnlineTranslationIds: [],
    })
    expect(enabledOnlineTranslations(settings)).toEqual([])
  })

  it('returns catalog entries for enabled ids when a key is present', () => {
    const settings = settingsWith({
      apiBibleKey: 'key',
      enabledOnlineTranslationIds: ['nkjv'],
    })
    expect(enabledOnlineTranslations(settings)).toEqual([
      ONLINE_TRANSLATIONS.find((translation) => translation.id === 'nkjv'),
    ])
  })

  it('ignores enabled ids missing from the catalog', () => {
    const settings = settingsWith({
      apiBibleKey: 'key',
      enabledOnlineTranslationIds: ['nkjv', 'unknown'],
    })
    expect(enabledOnlineTranslations(settings).map(({ id }) => id)).toEqual([
      'nkjv',
    ])
  })
})
