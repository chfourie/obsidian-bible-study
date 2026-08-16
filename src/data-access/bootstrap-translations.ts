import type { BibleStudySettings } from './bible-study-settings.type'

const NON_TRANSLATION_MODULE_IDS = ['strongs-dictionaries']

const hasApiKey = (settings: BibleStudySettings): boolean =>
  settings.apiBibleKey !== null && settings.apiBibleKey.trim() !== ''

export const installedTranslationModuleIds = (
  settings: BibleStudySettings,
): string[] =>
  settings.installedModuleIds.filter(
    (moduleId) => !NON_TRANSLATION_MODULE_IDS.includes(moduleId),
  )

export const defaultTranslationCandidates = (
  settings: BibleStudySettings,
): string[] => [
  ...installedTranslationModuleIds(settings),
  ...(hasApiKey(settings) ? settings.enabledOnlineTranslationIds : []),
]

const bootstrapped = (
  current: string | null,
  candidates: string[],
): string | null =>
  current !== null && candidates.includes(current)
    ? current
    : (candidates[0] ?? null)

export const applyTranslationBootstrap = (
  settings: BibleStudySettings,
): BibleStudySettings => ({
  ...settings,
  defaultTranslationId: bootstrapped(
    settings.defaultTranslationId,
    defaultTranslationCandidates(settings),
  ),
  fallbackTranslationId: bootstrapped(
    settings.fallbackTranslationId,
    installedTranslationModuleIds(settings),
  ),
})
