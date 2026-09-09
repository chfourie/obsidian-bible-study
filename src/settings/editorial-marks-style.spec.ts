import { beforeEach, describe, expect, it } from 'vitest'
import { MARKS_OPACITY_DEFAULT, SUPPLIED_OPACITY_DEFAULT } from '../data-access'
import {
  applyEditorialMarksVariables,
  editorialMarksVariables,
  MARKS_OPACITY_VARIABLE,
  removeEditorialMarksVariables,
  resolveMarksOpacity,
  resolveSuppliedOpacity,
  SUPPLIED_OPACITY_VARIABLE,
} from './editorial-marks-style'

describe('editorialMarksVariables', () => {
  it('ships supplied words at 50 % and Editorial marks at 30 %', () => {
    expect([SUPPLIED_OPACITY_DEFAULT, MARKS_OPACITY_DEFAULT]).toEqual([50, 30])
    expect(editorialMarksVariables({})).toEqual({
      '--ss-supplied-opacity': '0.5',
      '--ss-marks-opacity': '0.3',
    })
  })

  it('emits a stored percentage as the property’s alpha', () => {
    expect(
      editorialMarksVariables({ suppliedOpacityPercent: 100, marksOpacityPercent: 5 }),
    ).toEqual({
      [SUPPLIED_OPACITY_VARIABLE]: '1',
      [MARKS_OPACITY_VARIABLE]: '0.05',
    })
  })

  it.each([4, 101, 50.5, '50', null, NaN])(
    'falls back to the factory value for the stored value %s, on the Highlight Wash’s range',
    (stored) => {
      expect(resolveSuppliedOpacity(stored)).toBe(SUPPLIED_OPACITY_DEFAULT)
      expect(resolveMarksOpacity(stored)).toBe(MARKS_OPACITY_DEFAULT)
    },
  )

  it('keeps the ends of the range', () => {
    expect(resolveSuppliedOpacity(5)).toBe(5)
    expect(resolveMarksOpacity(100)).toBe(100)
  })
})

describe('applyEditorialMarksVariables', () => {
  beforeEach(() => document.body.removeAttribute('style'))

  it('sets both properties on the body and removes them again', () => {
    applyEditorialMarksVariables(document.body, {
      suppliedOpacityPercent: 80,
      marksOpacityPercent: 30,
    })
    expect(document.body.style.getPropertyValue(SUPPLIED_OPACITY_VARIABLE)).toBe('0.8')
    expect(document.body.style.getPropertyValue(MARKS_OPACITY_VARIABLE)).toBe('0.3')

    removeEditorialMarksVariables(document.body)
    expect(document.body.style.getPropertyValue(SUPPLIED_OPACITY_VARIABLE)).toBe('')
    expect(document.body.style.getPropertyValue(MARKS_OPACITY_VARIABLE)).toBe('')
  })
})
