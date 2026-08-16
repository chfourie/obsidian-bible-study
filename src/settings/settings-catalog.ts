import { BSB_MODULE_ID, type DownloadableTranslation } from '../modules'
import type { SettingsCatalogEntry } from './settings-tab-model'

const BSB_CATALOG_ENTRY: SettingsCatalogEntry = {
  id: BSB_MODULE_ID,
  name: 'Berean Standard Bible',
  language: 'English',
  strongsTagged: true,
}

export const settingsCatalog =
  (
    fetchGetBibleCatalog: () => Promise<DownloadableTranslation[]>,
  ): (() => Promise<SettingsCatalogEntry[]>) =>
  async () => {
    const getBibleEntries = await fetchGetBibleCatalog().catch(
      (): DownloadableTranslation[] => [],
    )
    return [
      ...getBibleEntries.filter((entry) => entry.id !== BSB_MODULE_ID),
      BSB_CATALOG_ENTRY,
    ]
  }
