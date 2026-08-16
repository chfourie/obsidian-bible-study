import { BSB_MODULE_ID, type BollsCatalogTranslation } from '../modules'
import type { SettingsCatalogEntry } from './settings-tab-model'

const BSB_CATALOG_ENTRY: SettingsCatalogEntry = {
  id: BSB_MODULE_ID,
  name: 'Berean Standard Bible',
  language: 'English',
  strongsTagged: true,
}

const TAGGED_BOLLS_IDS = new Set(['kjv'])

export const settingsCatalog =
  (
    fetchBollsCatalog: () => Promise<BollsCatalogTranslation[]>,
  ): (() => Promise<SettingsCatalogEntry[]>) =>
  async () => {
    const bollsEntries = await fetchBollsCatalog().catch(
      (): BollsCatalogTranslation[] => [],
    )
    return [
      ...bollsEntries
        .filter((entry) => entry.id !== BSB_MODULE_ID)
        .map((entry) =>
          TAGGED_BOLLS_IDS.has(entry.id)
            ? { ...entry, strongsTagged: true }
            : entry,
        ),
      BSB_CATALOG_ENTRY,
    ]
  }
