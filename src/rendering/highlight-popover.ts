import { setIcon } from 'obsidian'
import {
  HIGHLIGHT_SLOTS,
  UNDERLINE_SLOTS,
  type HighlightSlot,
  type UnderlineSlot,
} from '../data-access'
import { activate, computeMenuPanelPosition, type AnchorRect } from '../ui'

// The excerpt row's choices. Outside Passage Editing it is "show only this"
// alone; Passage Editing swaps it for Show and Hide, so the caller names the
// set and this module holds only how each one reads.
export type ExcerptChoiceKind = 'showOnly' | 'show' | 'hide'

const EXCERPT_CHOICE_LABELS: Record<ExcerptChoiceKind, string> = {
  showOnly: 'Show only this',
  show: 'Show',
  hide: 'Hide',
}

export const QUICK_PATH_EXCERPT_CHOICES: readonly ExcerptChoiceKind[] = [
  'showOnly',
]

export const PASSAGE_EDITING_EXCERPT_CHOICES: readonly ExcerptChoiceKind[] = [
  'show',
  'hide',
]

// What the popover offers: a slot on one channel, the eraser that clears both,
// or an excerpt choice.
export type PopoverChoice =
  | { kind: 'highlight'; slot: HighlightSlot }
  | { kind: 'underline'; slot: UnderlineSlot }
  | { kind: 'erase' }
  | { kind: ExcerptChoiceKind }

export type HighlightPopover = {
  element: HTMLElement
  close: () => void
}

const positionPopover = (
  popover: HTMLElement,
  anchor: AnchorRect,
  view: Window,
): void => {
  const panel = popover.getBoundingClientRect()
  const { top, left } = computeMenuPanelPosition({
    anchor,
    panel: { width: panel.width, height: panel.height },
    viewport: { width: view.innerWidth, height: view.innerHeight },
    align: 'left',
  })
  popover.style.top = `${top}px`
  popover.style.left = `${left}px`
}

const addChoice = (
  row: HTMLElement,
  label: string,
  cls: string,
  choose: () => void,
): HTMLElement => {
  const button = row.createSpan({
    cls,
    attr: { role: 'menuitem', tabindex: -1, 'aria-label': label },
  })
  // The passage selection must survive the click that acts on it.
  button.addEventListener('mousedown', (event) => event.preventDefault())
  button.addEventListener('click', choose)
  button.addEventListener('keydown', activate(choose))
  return button
}

const addRow = (popover: HTMLElement): HTMLElement =>
  popover.createDiv({ cls: 'scripture-study-highlight-popover-row' })

const stepFor = (key: string, count: number, current: number): number | null => {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (current + 1) % count
    case 'ArrowLeft':
    case 'ArrowUp':
      return (current - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

// One tab stop for the whole menu; the arrow keys walk every choice in reading
// order across the rows, wrapping at either end.
const wireRovingFocus = (
  popover: HTMLElement,
  items: readonly HTMLElement[],
): void => {
  const focusItem = (index: number): void => {
    items.forEach((item, at) => {
      item.tabIndex = at === index ? 0 : -1
    })
    items[index].focus()
  }
  items[0].tabIndex = 0
  popover.addEventListener('keydown', (event) => {
    const current = items.findIndex((item) => item === event.target)
    if (current === -1) return
    const next = stepFor(event.key, items.length, current)
    if (next === null) return
    event.preventDefault()
    focusItem(next)
  })
}

export const openHighlightPopover = (options: {
  doc: Document
  anchor: AnchorRect
  onChoose: (choice: PopoverChoice) => void
  excerptChoices?: readonly ExcerptChoiceKind[]
}): HighlightPopover => {
  const {
    doc,
    anchor,
    onChoose,
    excerptChoices = QUICK_PATH_EXCERPT_CHOICES,
  } = options
  const popover = doc.body.createDiv({
    cls: 'scripture-study-highlight-popover',
    attr: { role: 'menu', 'aria-label': 'Highlight, underline and excerpt' },
  })
  const highlights = addRow(popover)
  const items = HIGHLIGHT_SLOTS.map((slot) =>
    addChoice(
      highlights,
      `Highlight ${slot}`,
      `scripture-study-highlight-swatch scripture-study-highlight-${slot}`,
      () => onChoose({ kind: 'highlight', slot }),
    ),
  )
  const underlines = addRow(popover)
  for (const slot of UNDERLINE_SLOTS) {
    items.push(
      addChoice(
        underlines,
        `Underline ${slot}`,
        `scripture-study-highlight-swatch scripture-study-underline-swatch scripture-study-underline-swatch-${slot}`,
        () => onChoose({ kind: 'underline', slot }),
      ),
    )
  }
  const eraser = addChoice(
    underlines,
    'Erase highlight and underline',
    'scripture-study-highlight-swatch scripture-study-highlight-eraser',
    () => onChoose({ kind: 'erase' }),
  )
  setIcon(eraser, 'eraser')
  items.push(eraser)
  const excerpt = addRow(popover)
  for (const kind of excerptChoices) {
    const label = EXCERPT_CHOICE_LABELS[kind]
    const choice = addChoice(
      excerpt,
      label,
      'scripture-study-highlight-swatch scripture-study-excerpt-choice',
      () => onChoose({ kind }),
    )
    choice.setText(label)
    items.push(choice)
  }
  wireRovingFocus(popover, items)

  const view = doc.defaultView
  if (view) positionPopover(popover, anchor, view)
  return { element: popover, close: () => popover.remove() }
}
