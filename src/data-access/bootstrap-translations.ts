import type { ScriptureStudySettings } from './scripture-study-settings.type'

const NON_TRANSLATION_MODULE_IDS = ['strongs-dictionaries']

const hasApiKey = (settings: ScriptureStudySettings): boolean =>
  settings.apiBibleKey !== null && settings.apiBibleKey.trim() !== ''

export const installedTranslationModuleIds = (
  settings: ScriptureStudySettings,
): string[] =>
  settings.installedModuleIds.filter(
    (moduleId) => !NON_TRANSLATION_MODULE_IDS.includes(moduleId),
  )

export const defaultTranslationCandidates = (
  settings: ScriptureStudySettings,
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
  settings: ScriptureStudySettings,
): ScriptureStudySettings => ({
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
