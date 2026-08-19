import {
  applyHighlightStroke,
  highlightSelectionRange,
  type HighlightRange,
  type PassageVerse,
} from '../highlights'
import type { HighlightCue } from '../reference'
import type { AnchorRect } from '../ui'
import {
  openHighlightPopover,
  type HighlightChoice,
  type HighlightPopover,
} from './highlight-popover'
import { passageSelectionRange } from './passage-selection'

export type HighlightEditContext = {
  cues: readonly HighlightCue[]
  verses: readonly PassageVerse[]
}

export type HighlightCueWriter = (cues: readonly HighlightCue[]) => void

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
    choice: HighlightChoice,
  ): void => {
    write(
      applyHighlightStroke(
        context.cues,
        { ...range, slot: choice },
        context.verses,
      ),
    )
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
