import { setIcon } from 'obsidian'
import { HIGHLIGHT_SLOTS } from '../data-access'
import { activate, computeMenuPanelPosition, type AnchorRect } from '../ui'

// A null slot is the eraser — the sixth position in the popover.
export type HighlightChoice = number | null

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
  popover: HTMLElement,
  label: string,
  cls: string,
  choose: () => void,
): HTMLElement => {
  const button = popover.createSpan({
    cls,
    attr: { role: 'menuitem', tabindex: 0, 'aria-label': label },
  })
  // The passage selection must survive the click that acts on it.
  button.addEventListener('mousedown', (event) => event.preventDefault())
  button.addEventListener('click', choose)
  button.addEventListener('keydown', activate(choose))
  return button
}

export const openHighlightPopover = (options: {
  doc: Document
  anchor: AnchorRect
  onChoose: (choice: HighlightChoice) => void
}): HighlightPopover => {
  const { doc, anchor, onChoose } = options
  const popover = doc.body.createDiv({
    cls: 'scripture-study-highlight-popover',
    attr: { role: 'menu', 'aria-label': 'Highlight' },
  })
  for (const slot of HIGHLIGHT_SLOTS) {
    addChoice(
      popover,
      `Highlight ${slot}`,
      `scripture-study-highlight-swatch scripture-study-highlight-${slot}`,
      () => onChoose(slot),
    )
  }
  const eraser = addChoice(
    popover,
    'Erase highlight',
    'scripture-study-highlight-swatch scripture-study-highlight-eraser',
    () => onChoose(null),
  )
  setIcon(eraser, 'eraser')

  const view = doc.defaultView
  if (view) positionPopover(popover, anchor, view)
  return { element: popover, close: () => popover.remove() }
}
