import {
  MARKS_OPACITY_DEFAULT,
  SUPPLIED_OPACITY_DEFAULT,
} from '../data-access'
import { resolveWashPercentage } from './highlight-palette'

// The two opacities are applied as custom properties on `body`, as the
// highlight palette is; styles.css reads them on `.scripture-study-supplied`
// and `.scripture-study-marks` with the factory values as fallbacks, so no
// stylesheet has to be injected (spec-books §10).
export const SUPPLIED_OPACITY_VARIABLE = '--ss-supplied-opacity'
export const MARKS_OPACITY_VARIABLE = '--ss-marks-opacity'

export type EditorialMarkOpacities = {
  suppliedOpacityPercent?: unknown
  marksOpacityPercent?: unknown
}

export const resolveSuppliedOpacity = (stored: unknown): number =>
  resolveWashPercentage(stored, SUPPLIED_OPACITY_DEFAULT)

export const resolveMarksOpacity = (stored: unknown): number =>
  resolveWashPercentage(stored, MARKS_OPACITY_DEFAULT)

export const editorialMarksVariables = (
  settings: EditorialMarkOpacities,
): Record<string, string> => ({
  [SUPPLIED_OPACITY_VARIABLE]: String(
    resolveSuppliedOpacity(settings.suppliedOpacityPercent) / 100,
  ),
  [MARKS_OPACITY_VARIABLE]: String(
    resolveMarksOpacity(settings.marksOpacityPercent) / 100,
  ),
})

export const applyEditorialMarksVariables = (
  body: HTMLElement,
  settings: EditorialMarkOpacities,
): void =>
  Object.entries(editorialMarksVariables(settings)).forEach(([name, value]) =>
    body.style.setProperty(name, value),
  )

export const removeEditorialMarksVariables = (body: HTMLElement): void =>
  Object.keys(editorialMarksVariables({})).forEach((name) =>
    body.style.removeProperty(name),
  )
