// Fields land with the features that need them; the settings ticket on the
// wayfinder map enumerates the v1 surface.
export type AnnotationOrdering = 'created-oldest-first' | 'path-a-z'

export const FONT_SCALE_MIN = 50
export const FONT_SCALE_MAX = 200
export const FONT_SCALE_STEP = 10
export const FONT_SCALE_DEFAULT = 100

export type ScriptureStudySettings = {
  installedModuleIds: string[]
  defaultTranslationId: string | null
  fallbackTranslationId: string | null
  languageFilter: string
  readerDetailsDefault: 'inline' | 'side-panel'
  readerNavDefault: 'tree' | 'breadcrumb'
  readerLayoutDefault: 'verse-per-line' | 'continuous'
  readerStrongsDefault: 'off' | 'on'
  readerFontScalePercent: number
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
  readerFontScalePercent: FONT_SCALE_DEFAULT,
  annotationsFolder: 'Annotations',
  annotationTemplatePath: null,
  annotationOrdering: 'created-oldest-first',
}
