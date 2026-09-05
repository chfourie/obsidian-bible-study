import {
  defaultHighlightPalette,
  defaultHighlightWash,
  HIGHLIGHT_SLOTS,
  HIGHLIGHT_WASH_MAX,
  HIGHLIGHT_WASH_MIN,
  type HighlightPalette,
  type HighlightSlot,
  type HighlightThemeMode,
  type HighlightWash,
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

const resolveMode = (
  stored: unknown,
  mode: HighlightThemeMode,
): string[] => {
  const colors = Array.isArray(stored) ? stored : []
  return defaultHighlightPalette()[mode].map((fallback, index) =>
    resolveColor(colors[index], fallback),
  )
}

export const resolveHighlightPalette = (stored: unknown): HighlightPalette => {
  const palette = (stored ?? {}) as Partial<Record<HighlightThemeMode, unknown>>
  return {
    light: resolveMode(palette.light, 'light'),
    dark: resolveMode(palette.dark, 'dark'),
  }
}

const resolvePercentage = (value: unknown, fallback: number): number =>
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
    light: resolvePercentage(wash.light, defaults.light),
    dark: resolvePercentage(wash.dark, defaults.dark),
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
  const modes: HighlightThemeMode[] = ['light', 'dark']
  return Object.fromEntries(
    modes.flatMap((mode) =>
      HIGHLIGHT_SLOTS.map((slot): [string, string] => [
        highlightSlotVariable(mode, slot),
        tint(palette[mode][slot - 1] ?? '#000000', wash[mode]),
      ]),
    ),
  )
}
