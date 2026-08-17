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

  it('aligns left edges when the align option is left', () => {
    const position = computeMenuPanelPosition({
      anchor,
      panel: { width: 180, height: 200 },
      viewport,
      align: 'left',
    })

    expect(position).toEqual({ top: 70, left: 500 })
  })

  it('keeps a left-aligned panel inside the viewport margin on the right', () => {
    const position = computeMenuPanelPosition({
      anchor: { ...anchor, left: 700, right: 780 },
      panel: { width: 180, height: 200 },
      viewport,
      align: 'left',
    })

    expect(position.left).toBe(612)
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

  describe('right placement (ribbon flyout)', () => {
    const ribbonAnchor = { top: 100, left: 4, right: 40, bottom: 132, width: 36 }

    it('flies out to the right of the anchor, tops aligned', () => {
      const position = computeMenuPanelPosition({
        anchor: ribbonAnchor,
        panel: { width: 220, height: 120 },
        viewport,
        placement: 'right',
      })

      expect(position).toEqual({ top: 100, left: 46 })
    })

    it('flips to the left of the anchor when the right side overflows', () => {
      const position = computeMenuPanelPosition({
        anchor: { top: 100, left: 700, right: 736, bottom: 132, width: 36 },
        panel: { width: 220, height: 120 },
        viewport,
        placement: 'right',
      })

      expect(position.left).toBe(474)
    })

    it('clamps a tall panel to the bottom viewport margin', () => {
      const position = computeMenuPanelPosition({
        anchor: { ...ribbonAnchor, top: 540, bottom: 572 },
        panel: { width: 220, height: 120 },
        viewport,
        placement: 'right',
      })

      expect(position.top).toBe(472)
    })
  })

  describe('no anchor (command entry, mobile)', () => {
    it('centres the panel horizontally near the top of the viewport', () => {
      const position = computeMenuPanelPosition({
        anchor: null,
        panel: { width: 220, height: 120 },
        viewport,
      })

      expect(position).toEqual({ top: 72, left: 290 })
    })

    it('clamps an oversized panel to the viewport margins', () => {
      const position = computeMenuPanelPosition({
        anchor: null,
        panel: { width: 900, height: 700 },
        viewport,
      })

      expect(position).toEqual({ top: 8, left: 8 })
    })
  })
})
