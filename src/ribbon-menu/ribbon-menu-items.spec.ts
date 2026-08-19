import { describe, expect, it, vi } from 'vitest'
import { buildRibbonMenuItems } from './ribbon-menu-items'

describe('buildRibbonMenuItems', () => {
  it('lists the reader and the study panel with their view icons', () => {
    const items = buildRibbonMenuItems({
      openReader: () => {},
      openStudyPanel: () => {},
    })

    expect(items.map((item) => [item.title, item.icon])).toEqual([
      ['Open reader', 'book-open-text'],
      ['Open study panel', 'book-marked'],
    ])
  })

  it('routes clicks to the injected actions', () => {
    const openReader = vi.fn()
    const openStudyPanel = vi.fn()
    const items = buildRibbonMenuItems({ openReader, openStudyPanel })

    items[0].onClick()
    expect(openReader).toHaveBeenCalledTimes(1)
    expect(openStudyPanel).not.toHaveBeenCalled()

    items[1].onClick()
    expect(openStudyPanel).toHaveBeenCalledTimes(1)
  })
})
