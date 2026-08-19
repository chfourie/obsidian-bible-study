import { describe, expect, it } from 'vitest'
import { defaultHighlightPalette } from '../data-access'
import {
  highlightPaletteVariables,
  resolveHighlightPalette,
} from './highlight-palette'

describe('resolveHighlightPalette', () => {
  it('keeps five valid hex colors per theme', () => {
    const palette = {
      light: ['#112233', '#223344', '#334455', '#445566', '#556677'],
      dark: ['#aabbcc', '#bbccdd', '#ccddee', '#ddeeff', '#eeff00'],
    }

    expect(resolveHighlightPalette(palette)).toEqual(palette)
  })

  it('falls back to the shipped default for missing or malformed slots', () => {
    const resolved = resolveHighlightPalette({
      light: ['#112233', 'not-a-color'],
      dark: undefined,
    })

    expect(resolved.light[0]).toBe('#112233')
    expect(resolved.light[1]).toBe(defaultHighlightPalette().light[1])
    expect(resolved.light).toHaveLength(5)
    expect(resolved.dark).toEqual(defaultHighlightPalette().dark)
  })

  it('lowercases and accepts shorthand hex', () => {
    const resolved = resolveHighlightPalette({ light: ['#ABC'] })

    expect(resolved.light[0]).toBe('#aabbcc')
  })

  it('resolves undefined to the shipped defaults', () => {
    expect(resolveHighlightPalette(undefined)).toEqual(defaultHighlightPalette())
  })
})

describe('highlightPaletteVariables', () => {
  it('emits one variable per slot and theme as a translucent wash', () => {
    const variables = highlightPaletteVariables({
      light: ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000'],
      dark: ['#102030', '#102030', '#102030', '#102030', '#102030'],
    })

    expect(Object.keys(variables)).toHaveLength(10)
    expect(variables['--ss-hl-light-1']).toBe('rgba(255, 0, 0, 0.45)')
    expect(variables['--ss-hl-light-5']).toBe('rgba(0, 0, 0, 0.45)')
    expect(variables['--ss-hl-dark-3']).toBe('rgba(16, 32, 48, 0.26)')
  })

  it('substitutes defaults for a partially stored palette', () => {
    const variables = highlightPaletteVariables({ light: ['#ff0000'] })

    expect(variables['--ss-hl-light-1']).toBe('rgba(255, 0, 0, 0.45)')
    expect(variables['--ss-hl-light-2']).toBe(
      highlightPaletteVariables(defaultHighlightPalette())['--ss-hl-light-2'],
    )
    expect(Object.keys(variables)).toHaveLength(10)
  })
})
