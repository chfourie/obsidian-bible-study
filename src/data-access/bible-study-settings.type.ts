// Fields land with the features that need them; the settings ticket on the
// wayfinder map enumerates the v1 surface.
export type AnnotationOrdering = 'created-oldest-first' | 'path-a-z'

export type BibleStudySettings = {
  installedModuleIds: string[]
  defaultTranslationId: string | null
  fallbackTranslationId: string | null
  apiBibleKey: string | null
  readerDetailsDefault: 'inline' | 'side-panel'
  readerNavDefault: 'tree' | 'breadcrumb'
  readerLayoutDefault: 'verse-per-line' | 'continuous'
  annotationsFolder: string
  annotationTemplatePath: string | null
  annotationOrdering: AnnotationOrdering
}

export const DEFAULT_SETTINGS: BibleStudySettings = {
  installedModuleIds: [],
  defaultTranslationId: null,
  fallbackTranslationId: null,
  apiBibleKey: null,
  readerDetailsDefault: 'inline',
  readerNavDefault: 'tree',
  readerLayoutDefault: 'verse-per-line',
  annotationsFolder: 'Annotations',
  annotationTemplatePath: null,
  annotationOrdering: 'created-oldest-first',
}
