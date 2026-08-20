import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './scripture-study-settings.type'
import { applyReaderDefaultMigration } from './migrate-reader-defaults'

describe('applyReaderDefaultMigration', () => {
  it('leaves already-split defaults untouched', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      readerNavDefault: { desktop: 'breadcrumb', mobile: 'tree' },
    } as typeof DEFAULT_SETTINGS

    expect(applyReaderDefaultMigration(settings)).toEqual(settings)
  })

  it('carries a stored single-value default into both device slots', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      readerNavDefault: 'breadcrumb',
      readerLayoutDefault: 'continuous',
      readerStrongsDefault: 'on',
    } as unknown as typeof DEFAULT_SETTINGS

    const migrated = applyReaderDefaultMigration(settings)

    expect(migrated.readerNavDefault).toEqual({
      desktop: 'breadcrumb',
      mobile: 'breadcrumb',
    })
    expect(migrated.readerLayoutDefault).toEqual({
      desktop: 'continuous',
      mobile: 'continuous',
    })
    expect(migrated.readerStrongsDefault).toEqual({ desktop: 'on', mobile: 'on' })
  })

  it('leaves every other field untouched', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      readerNavDefault: 'tree',
      annotationsFolder: 'Study/Notes',
    } as unknown as typeof DEFAULT_SETTINGS

    expect(applyReaderDefaultMigration(settings).annotationsFolder).toBe(
      'Study/Notes',
    )
  })
})
