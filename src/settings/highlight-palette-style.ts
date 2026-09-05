import { highlightPaletteVariables } from './highlight-palette'

// The palette is applied as custom properties on `body`; styles.css maps
// `--ss-hl-light-N` / `--ss-hl-dark-N` onto `--ss-hl-N` per theme, so the
// theme switch stays in CSS and no stylesheet has to be injected.
export const applyHighlightPaletteVariables = (
  body: HTMLElement,
  palette: unknown,
  wash: unknown,
): void =>
  Object.entries(highlightPaletteVariables(palette, wash)).forEach(
    ([name, value]) => body.style.setProperty(name, value),
  )

export const removeHighlightPaletteVariables = (body: HTMLElement): void =>
  Object.keys(highlightPaletteVariables(undefined)).forEach((name) =>
    body.style.removeProperty(name),
  )
