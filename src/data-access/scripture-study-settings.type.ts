// Fields land with the features that need them; the settings ticket on the
// wayfinder map enumerates the v1 surface.
export type AnnotationOrdering = 'created-oldest-first' | 'path-a-z'

export const FONT_SCALE_MIN = 50
export const FONT_SCALE_MAX = 200
export const FONT_SCALE_STEP = 10
export const FONT_SCALE_DEFAULT = 100

export const HIGHLIGHT_SLOTS = [1, 2, 3, 4, 5] as const
export type HighlightSlot = (typeof HIGHLIGHT_SLOTS)[number]
export type HighlightThemeMode = 'light' | 'dark'
export type HighlightPalette = Record<HighlightThemeMode, string[]>

// Slots are picked as solid hues; the highlighter wash is the plugin's, so a
// picked color always tints without hiding the text under it.
export const HIGHLIGHT_TINT_ALPHA: Record<HighlightThemeMode, number> = {
  light: 0.45,
  dark: 0.26,
}

const SHIPPED_HIGHLIGHT_HUES = [
  '#ffd652',
  '#7ed98a',
  '#7dbeff',
  '#ff96be',
  '#ffb066',
]

export const DEFAULT_HIGHLIGHT_PALETTE: HighlightPalette = {
  light: [...SHIPPED_HIGHLIGHT_HUES],
  dark: [...SHIPPED_HIGHLIGHT_HUES],
}

export type ScriptureStudySettings = {
  installedModuleIds: string[]
  defaultTranslationId: string | null
  fallbackTranslationId: string | null
  languageFilter: string
  derivedRedLetter: boolean
  readerDetailsDefault: 'inline' | 'side-panel'
  readerNavDefault: 'tree' | 'breadcrumb'
  readerLayoutDefault: 'verse-per-line' | 'continuous'
  readerStrongsDefault: 'off' | 'on'
  readerFontScalePercent: number
  annotationsFolder: string
  annotationTemplatePath: string | null
  annotationOrdering: AnnotationOrdering
  highlightPalette: HighlightPalette
}

export const DEFAULT_SETTINGS: ScriptureStudySettings = {
  installedModuleIds: [],
  defaultTranslationId: null,
  fallbackTranslationId: null,
  languageFilter: 'English',
  derivedRedLetter: false,
  readerDetailsDefault: 'inline',
  readerNavDefault: 'tree',
  readerLayoutDefault: 'verse-per-line',
  readerStrongsDefault: 'off',
  readerFontScalePercent: FONT_SCALE_DEFAULT,
  annotationsFolder: 'Annotations',
  annotationTemplatePath: null,
  annotationOrdering: 'created-oldest-first',
  highlightPalette: DEFAULT_HIGHLIGHT_PALETTE,
}
