import {
  DEFAULT_HIGHLIGHT_PALETTE,
  HIGHLIGHT_SLOTS,
  HIGHLIGHT_TINT_ALPHA,
  type HighlightPalette,
  type HighlightSlot,
  type HighlightThemeMode,
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
  return DEFAULT_HIGHLIGHT_PALETTE[mode].map((fallback, index) =>
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

const tint = (hex: string, mode: HighlightThemeMode): string => {
  const channels = [1, 3, 5].map((offset) =>
    parseInt(hex.slice(offset, offset + 2), 16),
  )
  return `rgba(${channels.join(', ')}, ${HIGHLIGHT_TINT_ALPHA[mode]})`
}

export const highlightSlotVariable = (
  mode: HighlightThemeMode,
  slot: HighlightSlot,
): string => `--ss-hl-${mode}-${slot}`

export const highlightPaletteVariables = (
  stored: unknown,
): Record<string, string> => {
  const palette = resolveHighlightPalette(stored)
  const modes: HighlightThemeMode[] = ['light', 'dark']
  return Object.fromEntries(
    modes.flatMap((mode) =>
      HIGHLIGHT_SLOTS.map((slot): [string, string] => [
        highlightSlotVariable(mode, slot),
        tint(palette[mode][slot - 1] ?? '#000000', mode),
      ]),
    ),
  )
}
