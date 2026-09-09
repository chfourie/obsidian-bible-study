// Imported from the file rather than the modules barrel: the barrel pulls in
// the plugin features, which depend on this layer.
import { BOOK_CATALOGUE } from '../modules/book-catalogue'
import { bookAtomKind } from '../reference'
import type { AtomNumbers } from './atom-numbers'
import {
  perDeviceDefault,
  type PerDeviceDefault,
  type ScriptureStudySettings,
} from './scripture-study-settings.type'

const READER_OPTION_DEFAULT_KEYS = [
  'readerNavDefault',
  'readerLayoutDefault',
  'readerStrongsDefault',
] as const

// The retired global that stood for every Book at once (spec-books §5).
const PARA_NUMBERS_KEY = 'readerParaNumbersDefault'

type LegacySettings = ScriptureStudySettings &
  Partial<Record<typeof PARA_NUMBERS_KEY, PerDeviceDefault<AtomNumbers> | AtomNumbers>>

// Which Books the paragraph rule applies to is read off the compiled-in
// catalogue, the only Book knowledge available while settings load — the
// manifests are behind an async store. A Book the catalogue no longer lists
// is left to its factory value rather than guessed at.
const PARAGRAPH_BOOK_MODULE_IDS = BOOK_CATALOGUE.filter(
  (entry) => bookAtomKind(entry) === 'paragraph',
).map((entry) => entry.moduleId)

// Pre-split installs stored these as a single value. Carrying that value
// into both device slots keeps the upgrade user-invisible — nothing resets.
export const applyReaderDefaultMigration = (
  settings: ScriptureStudySettings,
): ScriptureStudySettings => {
  const migrated = { ...settings } as LegacySettings
  for (const key of READER_OPTION_DEFAULT_KEYS) {
    const value = migrated[key] as unknown
    if (typeof value === 'string') {
      Object.assign(migrated, { [key]: perDeviceDefault(value) })
    }
  }
  return applyAtomNumbersMigration(migrated)
}

// The old value seeds every installed paragraph Book once and is then gone,
// so a choice the reader already made survives while a verse-atom Book never
// inherits it. A Book the reader has since set for itself keeps its own.
const applyAtomNumbersMigration = (
  settings: LegacySettings,
): ScriptureStudySettings => {
  const { [PARA_NUMBERS_KEY]: stored, ...retired } = settings
  if (stored === undefined) return retired
  const seed = typeof stored === 'string' ? perDeviceDefault(stored) : stored
  const seeded = PARAGRAPH_BOOK_MODULE_IDS.filter((moduleId) =>
    retired.installedModuleIds.includes(moduleId),
  ).map((moduleId) => [moduleId, { ...seed }] as const)
  return {
    ...retired,
    bookAtomNumbers: {
      ...Object.fromEntries(seeded),
      ...retired.bookAtomNumbers,
    },
  }
}
