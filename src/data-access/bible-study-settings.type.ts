// Fields land with the features that need them; the settings ticket on the
// wayfinder map enumerates the v1 surface.
export type BibleStudySettings = {
  installedModuleIds: string[]
  defaultTranslationId: string | null
  readerDetailsDefault: 'inline' | 'side-panel'
  readerNavDefault: 'tree' | 'breadcrumb'
  readerLayoutDefault: 'verse-per-line' | 'continuous'
}

export const DEFAULT_SETTINGS: BibleStudySettings = {
  installedModuleIds: [],
  defaultTranslationId: null,
  readerDetailsDefault: 'inline',
  readerNavDefault: 'tree',
  readerLayoutDefault: 'verse-per-line',
}
