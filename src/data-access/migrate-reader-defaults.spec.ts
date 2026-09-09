import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './scripture-study-settings.type'
import { applyReaderDefaultMigration } from './migrate-reader-defaults'

const ALL_BOOKS = ['hum-m1895', 'in-at-e1', '1en-c1912', 'bsb']

// Stored data of any vintage — including fields this version no longer has.
const stored = (fields: Record<string, unknown>): typeof DEFAULT_SETTINGS =>
  ({ ...DEFAULT_SETTINGS, ...fields })

describe('applyReaderDefaultMigration', () => {
  it('leaves already-split defaults untouched', () => {
    const settings = stored({
      readerNavDefault: { desktop: 'breadcrumb', mobile: 'tree' },
    })

    expect(applyReaderDefaultMigration(settings)).toEqual(settings)
  })

  it('carries a stored single-value default into both device slots', () => {
    const settings = stored({
      readerNavDefault: 'breadcrumb',
      readerLayoutDefault: 'continuous',
      readerStrongsDefault: 'on',
    })

    const migrated = applyReaderDefaultMigration(settings)

    expect(migrated.readerNavDefault).toEqual({
      desktop: 'breadcrumb',
      mobile: 'breadcrumb',
    })
    expect(migrated.readerLayoutDefault).toEqual({
      desktop: 'continuous',
      mobile: 'continuous',
    })
    expect(migrated.readerStrongsDefault).toEqual({
      desktop: 'on',
      mobile: 'on',
    })
  })

  it('leaves every other field untouched', () => {
    const settings = stored({
      readerNavDefault: 'tree',
      annotationsFolder: 'Study/Notes',
    })

    expect(applyReaderDefaultMigration(settings).annotationsFolder).toBe(
      'Study/Notes',
    )
  })
})

describe('applyReaderDefaultMigration retiring the paragraph-numbers global', () => {
  it('seeds every installed paragraph Book once and drops the field', () => {
    const settings = stored({
      installedModuleIds: ALL_BOOKS,
      readerParaNumbersDefault: { desktop: 'on', mobile: 'on' },
    })

    const migrated = applyReaderDefaultMigration(settings)

    expect(migrated.bookAtomNumbers).toEqual({
      'hum-m1895': { desktop: 'on', mobile: 'on' },
      'in-at-e1': { desktop: 'on', mobile: 'on' },
    })
    expect('readerParaNumbersDefault' in migrated).toBe(false)
  })

  it('seeds each device slot from the slot it stood for', () => {
    const settings = stored({
      installedModuleIds: ['hum-m1895'],
      readerParaNumbersDefault: { desktop: 'on', mobile: 'hover' },
    })

    expect(applyReaderDefaultMigration(settings).bookAtomNumbers).toEqual({
      'hum-m1895': { desktop: 'on', mobile: 'hover' },
    })
  })

  it('seeds a pre-split single value into both slots of each Book', () => {
    const settings = stored({
      installedModuleIds: ['hum-m1895'],
      readerParaNumbersDefault: 'on',
    })

    expect(applyReaderDefaultMigration(settings).bookAtomNumbers).toEqual({
      'hum-m1895': { desktop: 'on', mobile: 'on' },
    })
  })

  it('never seeds a verse-atom Book, an uninstalled Book or a translation', () => {
    const settings = stored({
      installedModuleIds: ['1en-c1912', 'bsb'],
      readerParaNumbersDefault: { desktop: 'on', mobile: 'on' },
    })

    expect(applyReaderDefaultMigration(settings).bookAtomNumbers).toEqual({})
  })

  it('leaves a Book the reader has already set for itself alone', () => {
    const settings = stored({
      installedModuleIds: ALL_BOOKS,
      bookAtomNumbers: { 'hum-m1895': { desktop: 'hover', mobile: 'hover' } },
      readerParaNumbersDefault: { desktop: 'on', mobile: 'on' },
    })

    expect(applyReaderDefaultMigration(settings).bookAtomNumbers).toEqual({
      'hum-m1895': { desktop: 'hover', mobile: 'hover' },
      'in-at-e1': { desktop: 'on', mobile: 'on' },
    })
  })

  it('writes nothing on a fresh install that never stored the old field', () => {
    const settings = stored({ installedModuleIds: ALL_BOOKS })

    expect(applyReaderDefaultMigration(settings).bookAtomNumbers).toEqual({})
  })
})
