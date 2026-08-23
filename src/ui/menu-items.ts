// What an in-house menu panel renders: pure data the panel turns into rows.
// A checked item shows its state (a check mark, `aria-checked`); the click
// carries the activating event so callers can read its modifiers.
export type MenuItem = {
  title: string
  icon: string
  checked?: boolean
  onClick: (event: MouseEvent | KeyboardEvent) => void
}

// A heading-less section renders as bare items; a labelled one carries its
// heading above them.
export type MenuSection = { label: string | null; items: MenuItem[] }
