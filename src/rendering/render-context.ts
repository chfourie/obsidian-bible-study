import {
  installedTranslationModuleIds,
  type BibleStudySettings,
} from '../data-access'
import type { RenderContext } from './reference-render-model'

// Translation ids the grammar recognizes even before they are installed:
// the downloadable tier (getBible + BSB) and the API.Bible starter-tier
// licensed bibles (spec §6.1).
const WELL_KNOWN_TRANSLATION_IDS = [
  'kjv',
  'web',
  'asv',
  'bsb',
  'nkjv',
  'nlt',
  'nasb',
]

export const renderContextFromSettings = (
  settings: BibleStudySettings,
): RenderContext => {
  const installedTranslationIds = installedTranslationModuleIds(settings)
  return {
    knownTranslationIds: [
      ...new Set([...installedTranslationIds, ...WELL_KNOWN_TRANSLATION_IDS]),
    ],
    defaultTranslationId:
      settings.defaultTranslationId ?? installedTranslationIds[0] ?? null,
  }
}
