import {
  defaultHighlightPalette,
  defaultHighlightWash,
  defaultUnderlinePalette,
  HIGHLIGHT_SLOTS,
  HIGHLIGHT_THEME_MODES,
  HIGHLIGHT_WASH_MAX,
  HIGHLIGHT_WASH_MIN,
  type HighlightPalette,
  type HighlightSlot,
  type HighlightThemeMode,
  type HighlightWash,
  UNDERLINE_SLOTS,
  type UnderlinePalette,
  type UnderlineSlot,
} from '../data-access'

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

const expandShorthand = (hex: string): string =>
  hex.length === 4
    ? `#${[...hex.slice(1)].map((digit) => digit + digit).join('')}`
    : hex

const resolveColor = (value: unknown, fallback: string): string =>
  typeof value === 'string' && HEX_COLOR.test(value.trim())
    ? expandShorthand(value.trim().toLowerCase())
    : fallback

const resolveMode = (stored: unknown, defaults: string[]): string[] => {
  const colors = Array.isArray(stored) ? stored : []
  return defaults.map((fallback, index) => resolveColor(colors[index], fallback))
}

const resolvePalette = <Palette extends Record<HighlightThemeMode, string[]>>(
  stored: unknown,
  defaults: Palette,
): Palette => {
  const palette = (stored ?? {}) as Partial<Record<HighlightThemeMode, unknown>>
  return {
    ...defaults,
    light: resolveMode(palette.light, defaults.light),
    dark: resolveMode(palette.dark, defaults.dark),
  }
}

export const resolveHighlightPalette = (stored: unknown): HighlightPalette =>
  resolvePalette(stored, defaultHighlightPalette())

export const resolveUnderlinePalette = (stored: unknown): UnderlinePalette =>
  resolvePalette(stored, defaultUnderlinePalette())

// A stored percentage on the Highlight Wash's range, or the fallback when it
// is not one — the validation the wash and the two Editorial-mark opacities
// share (spec-books §10).
export const resolveWashPercentage = (value: unknown, fallback: number): number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= HIGHLIGHT_WASH_MIN &&
  value <= HIGHLIGHT_WASH_MAX
    ? value
    : fallback

export const resolveHighlightWash = (stored: unknown): HighlightWash => {
  const wash = (stored ?? {}) as Partial<Record<HighlightThemeMode, unknown>>
  const defaults = defaultHighlightWash()
  return {
    light: resolveWashPercentage(wash.light, defaults.light),
    dark: resolveWashPercentage(wash.dark, defaults.dark),
  }
}

const tint = (hex: string, percentage: number): string => {
  const channels = [1, 3, 5].map((offset) =>
    parseInt(hex.slice(offset, offset + 2), 16),
  )
  return `rgba(${channels.join(', ')}, ${percentage / 100})`
}

export const highlightSlotVariable = (
  mode: HighlightThemeMode,
  slot: HighlightSlot,
): string => `--ss-hl-${mode}-${slot}`

export const highlightPaletteVariables = (
  storedPalette: unknown,
  storedWash?: unknown,
): Record<string, string> => {
  const palette = resolveHighlightPalette(storedPalette)
  const wash = resolveHighlightWash(storedWash)
  return Object.fromEntries(
    HIGHLIGHT_THEME_MODES.flatMap((mode) =>
      HIGHLIGHT_SLOTS.map((slot): [string, string] => [
        highlightSlotVariable(mode, slot),
        tint(palette[mode][slot - 1] ?? '#000000', wash[mode]),
      ]),
    ),
  )
}

// The Underline Slots are published as they were picked: the Highlight Wash
// tints a background, and an underline is a line (CONTEXT.md — Underline
// Slot), so its colour is never washed.
export const underlineSlotVariable = (
  mode: HighlightThemeMode,
  slot: UnderlineSlot,
): string => `--ss-ul-${mode}-${slot}`

export const underlinePaletteVariables = (
  storedPalette: unknown,
): Record<string, string> => {
  const palette = resolveUnderlinePalette(storedPalette)
  return Object.fromEntries(
    HIGHLIGHT_THEME_MODES.flatMap((mode) =>
      UNDERLINE_SLOTS.map((slot): [string, string] => [
        underlineSlotVariable(mode, slot),
        palette[mode][slot - 1] ?? '#000000',
      ]),
    ),
  )
}
