import { describe, expect, it, vi } from 'vitest'
import { buildRibbonMenuItems } from './ribbon-menu-items'

const noActions = {
  openReader: () => {},
  openStudyPanel: () => {},
  openSearch: () => {},
}

describe('buildRibbonMenuItems', () => {
  it('lists the reader, the study panel and search with their view icons', () => {
    const items = buildRibbonMenuItems(noActions)

    expect(items.map((item) => [item.title, item.icon])).toEqual([
      ['Open reader', 'book-open-text'],
      ['Open study panel', 'book-marked'],
      ['Open search', 'search'],
    ])
  })

  it('routes clicks to the injected actions', () => {
    const openReader = vi.fn()
    const openStudyPanel = vi.fn()
    const openSearch = vi.fn()
    const items = buildRibbonMenuItems({
      openReader,
      openStudyPanel,
      openSearch,
    })

    items[0].onClick()
    expect(openReader).toHaveBeenCalledTimes(1)
    expect(openStudyPanel).not.toHaveBeenCalled()

    items[1].onClick()
    expect(openStudyPanel).toHaveBeenCalledTimes(1)

    items[2].onClick()
    expect(openSearch).toHaveBeenCalledTimes(1)
  })
})
