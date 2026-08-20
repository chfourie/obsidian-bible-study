// Actions are injected by the plugin so the menu never imports sibling
// features.
export type RibbonMenuActions = {
  openReader: () => void | Promise<void>
  openStudyPanel: () => void | Promise<void>
  openSearch: () => void | Promise<void>
}

export type RibbonMenuItem = {
  title: string
  icon: string
  onClick: () => void
}

export const buildRibbonMenuItems = (
  actions: RibbonMenuActions,
): RibbonMenuItem[] => [
  {
    title: 'Open reader',
    icon: 'book-open-text',
    onClick: () => void actions.openReader(),
  },
  {
    title: 'Open study panel',
    icon: 'book-marked',
    onClick: () => void actions.openStudyPanel(),
  },
  {
    title: 'Open search',
    icon: 'search',
    onClick: () => void actions.openSearch(),
  },
]
