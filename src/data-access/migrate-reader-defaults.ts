import {
  perDeviceDefault,
  type ScriptureStudySettings,
} from './scripture-study-settings.type'

const READER_OPTION_DEFAULT_KEYS = [
  'readerNavDefault',
  'readerLayoutDefault',
  'readerStrongsDefault',
] as const

// Pre-split installs stored these as a single value. Carrying that value
// into both device slots keeps the upgrade user-invisible — nothing resets.
export const applyReaderDefaultMigration = (
  settings: ScriptureStudySettings,
): ScriptureStudySettings => {
  const migrated = { ...settings }
  for (const key of READER_OPTION_DEFAULT_KEYS) {
    const value = migrated[key] as unknown
    if (typeof value === 'string') {
      Object.assign(migrated, { [key]: perDeviceDefault(value) })
    }
  }
  return migrated
}
