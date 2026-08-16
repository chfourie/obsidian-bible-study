// Fields land with the features that need them; the settings ticket on the
// wayfinder map enumerates the v1 surface.
export type AnnotationOrdering = 'created-oldest-first' | 'path-a-z'

export type ScriptureStudySettings = {
  installedModuleIds: string[]
  defaultTranslationId: string | null
  fallbackTranslationId: string | null
  languageFilter: string
  readerDetailsDefault: 'inline' | 'side-panel'
  readerNavDefault: 'tree' | 'breadcrumb'
  readerLayoutDefault: 'verse-per-line' | 'continuous'
  readerStrongsDefault: 'off' | 'on'
  annotationsFolder: string
  annotationTemplatePath: string | null
  annotationOrdering: AnnotationOrdering
}

export const DEFAULT_SETTINGS: ScriptureStudySettings = {
  installedModuleIds: [],
  defaultTranslationId: null,
  fallbackTranslationId: null,
  languageFilter: 'English',
  readerDetailsDefault: 'inline',
  readerNavDefault: 'tree',
  readerLayoutDefault: 'verse-per-line',
  readerStrongsDefault: 'off',
  annotationsFolder: 'Annotations',
  annotationTemplatePath: null,
  annotationOrdering: 'created-oldest-first',
}
