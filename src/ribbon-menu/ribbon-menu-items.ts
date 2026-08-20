import { opensInNewPane } from '../ui'

// One installed book as the menu needs it: the number its reader position
// carries and the title it is listed under.
export type RibbonMenuBook = { number: number; title: string }

// Actions are injected by the plugin so the menu never imports sibling
// features.
export type RibbonMenuActions = {
  openReader: () => void | Promise<void>
  openStudyPanel: () => void | Promise<void>
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
          title: 'Open reader',
          icon: 'book-open-text',
          onClick: () => void actions.openReader(),
        },
        {
          title: 'Open study panel',
          icon: 'book-marked',
          onClick: () => void actions.openStudyPanel(),
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
