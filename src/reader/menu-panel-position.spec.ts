import { describe, expect, it } from 'vitest'
import { computeMenuPanelPosition } from './menu-panel-position'

const anchor = { top: 40, left: 500, right: 580, bottom: 64, width: 80 }
const viewport = { width: 800, height: 600 }

describe('computeMenuPanelPosition', () => {
  it('drops the panel below the anchor with right edges aligned', () => {
    const position = computeMenuPanelPosition({
      anchor,
      panel: { width: 180, height: 200 },
      viewport,
    })

    expect(position).toEqual({ top: 70, left: 400 })
  })

  it('keeps the panel inside the viewport margins on the left', () => {
    const position = computeMenuPanelPosition({
      anchor: { ...anchor, left: 20, right: 100 },
      panel: { width: 180, height: 200 },
      viewport,
    })

    expect(position.left).toBe(8)
  })

  it('flips above the anchor when below would overflow the viewport bottom', () => {
    const position = computeMenuPanelPosition({
      anchor: { ...anchor, top: 500, bottom: 524 },
      panel: { width: 180, height: 200 },
      viewport,
    })

    expect(position.top).toBe(294)
  })

  it('clamps the panel fully inside the viewport when it fits neither below nor above', () => {
    const position = computeMenuPanelPosition({
      anchor: { ...anchor, top: 300, bottom: 324 },
      panel: { width: 180, height: 580 },
      viewport,
    })

    expect(position.top).toBe(12)
  })
})
