export { HIGHLIGHT_SLOTS, type HighlightSlot } from '../reference'

// Fields land with the features that need them; the settings ticket on the
// wayfinder map enumerates the v1 surface.
export type AnnotationOrdering = 'created-oldest-first' | 'path-a-z'

export const FONT_SCALE_MIN = 50
export const FONT_SCALE_MAX = 200
export const FONT_SCALE_STEP = 10
export const FONT_SCALE_DEFAULT = 100

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

// Handed out as a fresh copy so editing a palette can never reach the hues
// the plugin ships with.
export const defaultHighlightPalette = (): HighlightPalette => ({
  light: [...SHIPPED_HIGHLIGHT_HUES],
  dark: [...SHIPPED_HIGHLIGHT_HUES],
})

// Every reader option with a global settings default is seeded per device —
// a new pane picks its slot by the device it opens on; in-pane switching
// never writes back to either slot.
export type ReaderDevice = 'desktop' | 'mobile'
export type PerDeviceDefault<T> = Record<ReaderDevice, T>

export const perDeviceDefault = <T>(value: T): PerDeviceDefault<T> => ({
  desktop: value,
  mobile: value,
})

export type ScriptureStudySettings = {
  installedModuleIds: string[]
  defaultTranslationId: string | null
  fallbackTranslationId: string | null
  languageFilter: string
  derivedRedLetter: boolean
  readerNavDefault: PerDeviceDefault<'tree' | 'breadcrumb'>
  readerLayoutDefault: PerDeviceDefault<'verse-per-line' | 'continuous'>
  readerStrongsDefault: PerDeviceDefault<'off' | 'on'>
  readerParaNumbersDefault: PerDeviceDefault<'on' | 'hover'>
  readerFontScalePercent: number
  revealPanelOnSelection: boolean
  annotationsFolder: string
  crossReferencesFolder: string
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
  readerNavDefault: perDeviceDefault('tree'),
  readerLayoutDefault: perDeviceDefault('verse-per-line'),
  readerStrongsDefault: perDeviceDefault('off'),
  readerParaNumbersDefault: perDeviceDefault('hover'),
  readerFontScalePercent: FONT_SCALE_DEFAULT,
  revealPanelOnSelection: true,
  annotationsFolder: 'Annotations',
  crossReferencesFolder: '',
  annotationTemplatePath: null,
  annotationOrdering: 'created-oldest-first',
  highlightPalette: defaultHighlightPalette(),
}
