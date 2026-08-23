import { opensInNewPane } from '../ui'

// One installed book as the menu needs it: the number its reader position
// carries and the title it is listed under.
export type RibbonMenuBook = { number: number; title: string }

// Actions are injected by the plugin so the menu never imports sibling
// features.
export type RibbonMenuActions = {
  openReader: (options: { newTab: boolean }) => void | Promise<void>
  // The study panel is the workspace's single right-sidebar view following
  // whichever reader has focus, so a second instance would have nothing of
  // its own to show — it takes no new-tab intent.
  openStudyPanel: () => void | Promise<void>
  openSearch: () => void | Promise<void>
  installedBooks: () => Promise<RibbonMenuBook[]>
  openBook: (
    book: number,
    options: { newTab: boolean },
  ) => void | Promise<void>
}

export type RibbonMenuItem = {
  title: string
  icon: string
  onClick: (event: MouseEvent | KeyboardEvent) => void
}

// A heading-less section renders as bare items; a labelled one carries its
// heading above them.
export type RibbonMenuSection = { label: string | null; items: RibbonMenuItem[] }

export const buildRibbonMenuSections = async (
  actions: RibbonMenuActions,
): Promise<RibbonMenuSection[]> => {
  const books = await actions.installedBooks()
  return [
    {
      label: null,
      items: [
        {
          title: 'Open scripture reader',
          icon: 'book-open-text',
          onClick: (event: MouseEvent | KeyboardEvent) =>
            void actions.openReader({ newTab: opensInNewPane(event) }),
        },
        {
          title: 'Open study panel',
          icon: 'book-marked',
          onClick: () => void actions.openStudyPanel(),
        },
        {
          title: 'Open search',
          icon: 'text-search',
          onClick: () => void actions.openSearch(),
        },
      ],
    },
    // Uninstalled books are simply absent, so no book installed means no
    // Books section at all (ticket #78).
    ...(books.length === 0
      ? []
      : [
          {
            label: 'Books',
            items: books.map((book) => ({
              title: book.title,
              icon: 'book',
              onClick: (event: MouseEvent | KeyboardEvent) =>
                void actions.openBook(book.number, {
                  newTab: opensInNewPane(event),
                }),
            })),
          },
        ]),
  ]
}
