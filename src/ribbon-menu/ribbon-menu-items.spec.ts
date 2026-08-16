import { describe, expect, it, vi } from 'vitest'
import { buildRibbonMenuItems } from './ribbon-menu-items'

describe('buildRibbonMenuItems', () => {
  it('lists the reader and the references panel with their view icons', () => {
    const items = buildRibbonMenuItems({
      openReader: () => {},
      openReferencesPanel: () => {},
    })

    expect(items.map((item) => [item.title, item.icon])).toEqual([
      ['Open reader', 'book-open-text'],
      ['Open references panel', 'book-marked'],
    ])
  })

  it('routes clicks to the injected actions', () => {
    const openReader = vi.fn()
    const openReferencesPanel = vi.fn()
    const items = buildRibbonMenuItems({ openReader, openReferencesPanel })

    items[0].onClick()
    expect(openReader).toHaveBeenCalledTimes(1)
    expect(openReferencesPanel).not.toHaveBeenCalled()

    items[1].onClick()
    expect(openReferencesPanel).toHaveBeenCalledTimes(1)
  })
})
