import {
  applyExcerptStroke,
  applyHighlightStroke,
  applyUnderlineStroke,
  highlightSelectionRange,
  type CueLists,
  type HighlightRange,
  type VerseText,
} from '../highlights'
import { activate, type AnchorRect } from '../ui'
import {
  openHighlightPopover,
  PASSAGE_EDITING_EXCERPT_CHOICES,
  QUICK_PATH_EXCERPT_CHOICES,
  type HighlightPopover,
  type PopoverChoice,
} from './highlight-popover'
import { passageSelectionRange } from './passage-selection'
import type { PassageViewOptions } from './passage-view'

// Every channel the occurrence carries: a stroke on one channel writes the
// other two back untouched, so the writer always receives all three.
export type HighlightEditContext = CueLists & {
  verses: readonly VerseText[]
}

export type CueWriteOptions = {
  // The write was made from Passage Editing, which the author has not left:
  // the occurrence rebuilt from it should open in the mode again.
  passageEditing: boolean
}

export type HighlightCueWriter = (
  cues: CueLists,
  options?: CueWriteOptions,
) => void

// What the renderer lends Passage Editing (CONTEXT.md): the control that
// stands at the chip's end, and a way to draw the passage again, whole with
// its elided text faded or trimmed as usual.
export type PassageEditingSurface = {
  control: HTMLElement
  render: (options: PassageViewOptions) => void
}

export type PassageEditingOptions = {
  surface: PassageEditingSurface
  resume?: boolean
}

// Hide with no Excerpt to narrow starts from the whole served passage, one
// part per contiguous run (spec story 49); the engine knows no "everything".
const wholePassageParts = (verses: readonly VerseText[]): CueLists['excerpt'] => {
  const first = verses[0]
  const last = verses[verses.length - 1]
  if (first === undefined || last === undefined) return []
  return applyExcerptStroke(
    [],
    {
      startVerseId: first.verseId,
      startChar: 0,
      endVerseId: last.verseId,
      endChar: last.text.length,
      action: 'show',
    },
    verses,
  )
}

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
    case 'showOnly':
    case 'show':
      return {
        highlights,
        underlines,
        excerpt: applyExcerptStroke(
          excerpt,
          { ...range, action: 'show' },
          verses,
        ),
      }
    case 'hide':
      return {
        highlights,
        underlines,
        excerpt: applyExcerptStroke(
          excerpt.length === 0 ? wholePassageParts(verses) : excerpt,
          { ...range, action: 'hide' },
          verses,
        ),
      }
  }
}

const EDITABLE_CLASS = 'scripture-study-highlight-editable'
const EDITING_CLASS = 'scripture-study-passage-editing'
const TOOLBAR_CLASS = 'scripture-study-passage-editing-toolbar'

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

const addToolbarButton = (
  toolbar: HTMLElement,
  label: string,
  cls: string,
  press: () => void,
): HTMLElement => {
  const button = toolbar.createSpan({
    cls: `scripture-study-passage-editing-button ${cls}`,
    attr: { role: 'button', tabindex: 0 },
    text: label,
  })
  button.addEventListener('click', press)
  button.addEventListener('keydown', activate(press))
  return button
}

// Only one occurrence is in Passage Editing at a time (CONTEXT.md): entering
// it elsewhere ends it here.
let current: (() => void) | null = null

type PassageEditingMode = {
  active: () => boolean
  toggle: () => void
  leave: () => void
  // Drops the mode's listeners and toolbar without drawing the passage again,
  // for a host that is being torn down anyway.
  detach: () => void
}

const passageEditingMode = (
  host: HTMLElement,
  context: HighlightEditContext,
  write: HighlightCueWriter,
  surface: PassageEditingSurface,
  popover: () => HighlightPopover | null,
  closePopover: () => void,
): PassageEditingMode => {
  const doc = host.ownerDocument
  const { control } = surface
  let toolbar: HTMLElement | null = null
  let unwire: (() => void) | null = null
  const active = (): boolean => toolbar !== null

  const insideWidget = (target: EventTarget | null): boolean =>
    target instanceof Node &&
    [host, control, toolbar, popover()?.element ?? null].some(
      (element) => element?.contains(target) ?? false,
    )

  const teardown = (): void => {
    unwire?.()
    unwire = null
    toolbar?.remove()
    toolbar = null
    closePopover()
    host.removeClass(EDITING_CLASS)
    control.setAttribute('aria-pressed', 'false')
    if (current === leave) current = null
  }

  const leave = (): void => {
    if (!active()) return
    teardown()
    surface.render({})
  }

  const mountToolbar = (): HTMLElement => {
    const bar = host.createDiv({ cls: TOOLBAR_CLASS })
    const clear = addToolbarButton(
      bar,
      'Clear excerpt',
      'scripture-study-passage-editing-clear',
      () => {
        if (context.excerpt.length === 0) return
        write(
          { highlights: context.highlights, underlines: context.underlines, excerpt: [] },
          { passageEditing: true },
        )
      },
    )
    if (context.excerpt.length === 0) clear.setAttribute('aria-disabled', 'true')
    addToolbarButton(bar, 'Done', 'scripture-study-passage-editing-done', leave)
    host.insertAdjacentElement('afterend', bar)
    return bar
  }

  // A pointer-down anywhere outside the widget leaves, while a drag that
  // starts inside may end wherever it likes. Escape is the popover's key
  // first and only then the mode's, so it is handled beside the popover.
  const wireLeaving = (): (() => void) => {
    const onPointerDown = (event: Event): void => {
      if (!insideWidget(event.target)) leave()
    }
    doc.addEventListener('pointerdown', onPointerDown)
    return () => doc.removeEventListener('pointerdown', onPointerDown)
  }

  const enter = (): void => {
    if (active()) return
    current?.()
    current = leave
    host.addClass(EDITING_CLASS)
    control.setAttribute('aria-pressed', 'true')
    surface.render({ elision: false })
    toolbar = mountToolbar()
    unwire = wireLeaving()
  }

  return {
    active,
    toggle: () => (active() ? leave() : enter()),
    leave,
    detach: () => {
      if (active()) teardown()
    },
  }
}

const wireControl = (control: HTMLElement, toggle: () => void): void => {
  // The control sits inside the chip, whose own activation opens the reader.
  control.addEventListener('click', (event) => {
    event.stopPropagation()
    toggle()
  })
  control.addEventListener(
    'keydown',
    activate((event) => {
      event.stopPropagation()
      toggle()
    }),
  )
  control.setAttribute('aria-pressed', 'false')
}

export const attachHighlightEditing = (
  host: HTMLElement,
  context: HighlightEditContext,
  write: HighlightCueWriter,
  passageEditing?: PassageEditingOptions,
): (() => void) => {
  const doc = host.ownerDocument
  host.addClass(EDITABLE_CLASS)
  let popover: HighlightPopover | null = null

  const close = (): void => {
    popover?.close()
    popover = null
  }

  const mode =
    passageEditing === undefined
      ? null
      : passageEditingMode(
          host,
          context,
          write,
          passageEditing.surface,
          () => popover,
          close,
        )
  const inMode = (): boolean => mode?.active() ?? false

  const strokeAndClose = (
    range: HighlightRange,
    choice: PopoverChoice,
  ): void => {
    const cues = strokedCues(context, range, choice)
    if (inMode()) write(cues, { passageEditing: true })
    else write(cues)
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
      excerptChoices: inMode()
        ? PASSAGE_EDITING_EXCERPT_CHOICES
        : QUICK_PATH_EXCERPT_CHOICES,
    })
  }

  // A drag that starts in the passage can finish anywhere, so the release is
  // watched on the document and the selection is clamped back to the passage.
  doc.addEventListener('mouseup', onSelectionSettled)
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    if (popover !== null) close()
    else mode?.leave()
  }
  doc.addEventListener('keydown', onKeyDown)

  if (mode !== null && passageEditing !== undefined) {
    wireControl(passageEditing.surface.control, mode.toggle)
    if (passageEditing.resume === true) mode.toggle()
  }

  return () => {
    mode?.detach()
    close()
    host.removeClass(EDITABLE_CLASS)
    doc.removeEventListener('mouseup', onSelectionSettled)
    doc.removeEventListener('keydown', onKeyDown)
  }
}
