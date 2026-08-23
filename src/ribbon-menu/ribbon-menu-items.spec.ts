import { describe, expect, it, vi } from 'vitest'
import { buildRibbonMenuSections } from './ribbon-menu-items'

const actions = (overrides = {}) => ({
  openReader: () => {},
  openStudyPanel: () => {},
  openSearch: () => {},
  installedBooks: async () => [],
  openBook: () => {},
  ...overrides,
})

const click = (options: MouseEventInit = {}): MouseEvent =>
  new MouseEvent('click', options)

describe('buildRibbonMenuSections', () => {
  it('lists the reader, the study panel and search with their view icons', async () => {
    const sections = await buildRibbonMenuSections(actions())

    expect(sections).toHaveLength(1)
    expect(sections[0].label).toBe(null)
    expect(sections[0].items.map((item) => [item.title, item.icon])).toEqual([
      ['Open scripture reader', 'book-open-text'],
      ['Open study panel', 'book-marked'],
      ['Open search', 'text-search'],
    ])
  })

  it('routes clicks to the injected actions', async () => {
    const openReader = vi.fn()
    const openStudyPanel = vi.fn()
    const openSearch = vi.fn()
    const sections = await buildRibbonMenuSections(
      actions({ openReader, openStudyPanel, openSearch }),
    )
    const [reader, studyPanel, search] = sections[0].items

    reader.onClick(click())
    expect(openReader).toHaveBeenCalledTimes(1)
    expect(openStudyPanel).not.toHaveBeenCalled()

    studyPanel.onClick(click())
    expect(openStudyPanel).toHaveBeenCalledTimes(1)

    search.onClick(click())
    expect(openSearch).toHaveBeenCalledTimes(1)
  })

  // The gap the user hit: the reader entry carried no modifier intent at all,
  // so a mod-click could only ever reuse the open reader (tickets #78/#75).
  it('opens the reader in a tab of its own on a mod-click', async () => {
    const openReader = vi.fn()
    const sections = await buildRibbonMenuSections(actions({ openReader }))
    const reader = sections[0].items[0]

    reader.onClick(click())
    expect(openReader).toHaveBeenLastCalledWith({ newTab: false })

    reader.onClick(click({ metaKey: true }))
    expect(openReader).toHaveBeenLastCalledWith({ newTab: true })

    reader.onClick(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }))
    expect(openReader).toHaveBeenLastCalledWith({ newTab: true })
  })

  // Where the reader's books are reachable from now that the nav faces stay
  // as they were: a Books section in the ribbon panel (ticket #78).
  it('lists the installed books under a Books heading', async () => {
    const sections = await buildRibbonMenuSections(
      actions({
        installedBooks: async () => [
          { number: 101, title: 'Humility' },
          { number: 102, title: 'The Pursuit of God' },
        ],
      }),
    )

    expect(sections).toHaveLength(2)
    expect(sections[1].label).toBe('Books')
    expect(sections[1].items.map((item) => [item.title, item.icon])).toEqual([
      ['Humility', 'book'],
      ['The Pursuit of God', 'book'],
    ])
  })

  it('leaves the Books section out entirely when no book is installed', async () => {
    const sections = await buildRibbonMenuSections(actions())

    expect(sections.map((section) => section.label)).toEqual([null])
  })

  it('opens a book in this tab, or in one of its own on a mod-click', async () => {
    const openBook = vi.fn()
    const sections = await buildRibbonMenuSections(
      actions({
        openBook,
        installedBooks: async () => [{ number: 101, title: 'Humility' }],
      }),
    )
    const book = sections[1].items[0]

    book.onClick(click())
    expect(openBook).toHaveBeenLastCalledWith(101, { newTab: false })

    book.onClick(click({ metaKey: true }))
    expect(openBook).toHaveBeenLastCalledWith(101, { newTab: true })

    book.onClick(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }))
    expect(openBook).toHaveBeenLastCalledWith(101, { newTab: true })
  })
})
