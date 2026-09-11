import {
  applyHighlightStroke,
  applyUnderlineStroke,
  highlightSelectionRange,
  type CueLists,
  type HighlightRange,
  type VerseText,
} from '../highlights'
import type { AnchorRect } from '../ui'
import {
  openHighlightPopover,
  type HighlightPopover,
  type PopoverChoice,
} from './highlight-popover'
import { passageSelectionRange } from './passage-selection'

// Every channel the occurrence carries: a stroke on one channel writes the
// other two back untouched, so the writer always receives all three.
export type HighlightEditContext = CueLists & {
  verses: readonly VerseText[]
}

export type HighlightCueWriter = (cues: CueLists) => void

// Channels never see each other; the eraser is the one gesture that runs on
// two of them, and it still does so one channel at a time (spec — Stroke
// engine per channel).
export const strokedCues = (
  context: HighlightEditContext,
  range: HighlightRange,
  choice: PopoverChoice,
): CueLists => {
  const { highlights, underlines, excerpt, verses } = context
  switch (choice.kind) {
    case 'highlight':
      return {
        highlights: applyHighlightStroke(
          highlights,
          { ...range, slot: choice.slot },
          verses,
        ),
        underlines,
        excerpt,
      }
    case 'underline':
      return {
        highlights,
        underlines: applyUnderlineStroke(
          underlines,
          { ...range, slot: choice.slot },
          verses,
        ),
        excerpt,
      }
    case 'erase':
      return {
        highlights: applyHighlightStroke(
          highlights,
          { ...range, slot: null },
          verses,
        ),
        underlines: applyUnderlineStroke(
          underlines,
          { ...range, slot: null },
          verses,
        ),
        excerpt,
      }
  }
}

const EDITABLE_CLASS = 'scripture-study-highlight-editable'

const ORIGIN: AnchorRect = { top: 0, left: 0, right: 0, bottom: 0, width: 0 }

const anchorOf = (range: Range): AnchorRect => {
  const rect = range.getBoundingClientRect?.()
  return rect === undefined ? ORIGIN : rect
}

const selectionInside = (host: HTMLElement): Range | null => {
  const selection = host.ownerDocument.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
    return null
  return selection.getRangeAt(0)
}

export const attachHighlightEditing = (
  host: HTMLElement,
  context: HighlightEditContext,
  write: HighlightCueWriter,
): (() => void) => {
  const doc = host.ownerDocument
  host.addClass(EDITABLE_CLASS)
  let popover: HighlightPopover | null = null

  const close = (): void => {
    popover?.close()
    popover = null
  }

  const strokeAndClose = (
    range: HighlightRange,
    choice: PopoverChoice,
  ): void => {
    write(strokedCues(context, range, choice))
    doc.getSelection()?.removeAllRanges()
    close()
  }

  const onSelectionSettled = (event: MouseEvent): void => {
    // Releasing the mouse on a swatch is the choice itself — tearing the
    // popover down here would remove the element before its click lands.
    const target = event.target
    if (
      popover !== null &&
      target instanceof Node &&
      popover.element.contains(target)
    ) {
      return
    }
    close()
    const selected = selectionInside(host)
    if (selected === null) return
    const selection = passageSelectionRange(host, selected)
    if (selection === null) return
    const stroke = highlightSelectionRange(selection, context.verses)
    if (stroke === null) return
    popover = openHighlightPopover({
      doc,
      anchor: anchorOf(selected),
      onChoose: (choice) => strokeAndClose(stroke, choice),
    })
  }

  // A drag that starts in the passage can finish anywhere, so the release is
  // watched on the document and the selection is clamped back to the passage.
  doc.addEventListener('mouseup', onSelectionSettled)
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') close()
  }
  doc.addEventListener('keydown', onKeyDown)

  return () => {
    close()
    host.removeClass(EDITABLE_CLASS)
    doc.removeEventListener('mouseup', onSelectionSettled)
    doc.removeEventListener('keydown', onKeyDown)
  }
}
