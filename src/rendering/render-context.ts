import {
  installedTranslationModuleIds,
  type ScriptureStudySettings,
} from '../data-access'
import type { RenderContext } from './reference-render-model'

// Translation ids the grammar recognizes even before they are installed:
// common ids from the bolls.life catalogue plus BSB (spec §6.1).
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
  settings: ScriptureStudySettings,
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
