import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../data-access'
import {
  enabledOnlineTranslations,
  gatedApiBibleIdFor,
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

describe('gatedApiBibleIdFor', () => {
  it('resolves the API.Bible id only while the translation is enabled', () => {
    const enabled = settingsWith({
      apiBibleKey: 'key',
      enabledOnlineTranslationIds: ['nkjv'],
    })
    expect(gatedApiBibleIdFor(enabled)('nkjv')).toBe('63097d2a0a2f7db3-01')
    expect(gatedApiBibleIdFor(settingsWith({}))('nkjv')).toBeNull()
    expect(gatedApiBibleIdFor(enabled)('unknown')).toBeNull()
  })
})
