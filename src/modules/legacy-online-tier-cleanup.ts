import type { ModuleDataDir } from './module-data-dir'

// Leftovers of the API.Bible online tier removed in v1.1: the on-disk
// passage cache and the FUMS device id. Cleanup is best-effort — a failure
// never blocks plugin load.
const LEGACY_PASSAGE_CACHE_DIR = 'cache'
const LEGACY_FUMS_DEVICE_ID_KEY = 'scripture-study-fums-device-id'

export const removeLegacyOnlineTierArtifacts = async (
  dataDir: ModuleDataDir,
): Promise<void> => {
  try {
    await dataDir.removeDir(LEGACY_PASSAGE_CACHE_DIR)
  } catch {
    // best-effort
  }
  try {
    window.localStorage.removeItem(LEGACY_FUMS_DEVICE_ID_KEY)
  } catch {
    // best-effort
  }
}
