import type { ScriptureStudySettings } from '../data-access'

export type OnlineTranslation = {
  id: string
  apiBibleId: string
  name: string
}

// Starter-tier licensed English Bibles (spec §6.1). NLT and NASB 1995 ids
// land once verified against a live key; the catalog shape already fits them.
export const ONLINE_TRANSLATIONS: readonly OnlineTranslation[] = [
  {
    id: 'nkjv',
    apiBibleId: '63097d2a0a2f7db3-01',
    name: 'New King James Version',
  },
]

export const apiBibleIdFor = (translationId: string): string | null =>
  ONLINE_TRANSLATIONS.find((translation) => translation.id === translationId)
    ?.apiBibleId ?? null

export const gatedApiBibleIdFor =
  (settings: ScriptureStudySettings) =>
  (translationId: string): string | null =>
    enabledOnlineTranslations(settings).some(
      ({ id }) => id === translationId,
    )
      ? apiBibleIdFor(translationId)
      : null

export const enabledOnlineTranslations = (
  settings: ScriptureStudySettings,
): OnlineTranslation[] =>
  settings.apiBibleKey === null || settings.apiBibleKey.trim() === ''
    ? []
    : ONLINE_TRANSLATIONS.filter((translation) =>
        settings.enabledOnlineTranslationIds.includes(translation.id),
      )
