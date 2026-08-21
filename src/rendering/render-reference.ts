import { setIcon } from 'obsidian'
import type { NavigationOptions } from '../contracts'
import type { Reference } from '../reference'
import { opensInNewPane } from '../ui'
import { isAnnotation, noteTitle, type OccurrenceGroup } from '../vault-index'
import type { HighlightEditContext } from './highlight-editing'
import type {
  Passage,
  PassageSource,
  VerseSegment,
} from './module-passage-source'
import { VERSE_TEXT_CLASS } from './passage-selection'
import { spanSegments } from './segment-spans'
import {
  buildPassageView,
  loadingText,
  unavailableText,
  type PassageView,
} from './passage-view'
import type { ReferenceRenderModel } from './reference-render-model'

export type NoteIntersectionSource = {
  intersecting: (reference: Reference) => OccurrenceGroup[]
  openNote: (file: string) => void
}

export type FirstRunInstallDeps = {
  translationName: string
  install: () => Promise<void>
}

// Present only where highlights are editable (Live Preview on desktop);
// Reading mode, embeds, and mobile render the same passage without it.
export type HighlightEditAttach = (
  host: HTMLElement,
  context: HighlightEditContext,
) => void

export type ReferenceRenderDeps = {
  passages: PassageSource
  openReference: (
    model: ReferenceRenderModel,
    options: NavigationOptions,
  ) => void
  intersections?: NoteIntersectionSource
  firstRun?: FirstRunInstallDeps
  editHighlights?: HighlightEditAttach
}

const activateAsButton = (
  element: HTMLElement,
  action: (event: MouseEvent | KeyboardEvent) => void,
): void => {
  element.addEventListener('click', action)
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    action(event)
  })
}

const renderChip = (
  parent: HTMLElement,
  model: ReferenceRenderModel,
  deps: ReferenceRenderDeps,
): void => {
  const chip = parent.createSpan({
    cls:
      model.book === null
        ? 'scripture-study-chip'
        : 'scripture-study-chip scripture-study-chip-book',
    attr: { role: 'button', tabindex: 0 },
  })
  const ref = chip.createSpan({ cls: 'scripture-study-chip-ref' })
  if (model.book === null) {
    ref.setText(model.referenceText)
  } else {
    ref.createEl('em', { text: model.book.title })
    ref.appendText(` ${model.book.locator}`)
  }
  if (model.chipLabel !== null) {
    chip.createSpan({
      cls: 'scripture-study-chip-translation',
      text: model.chipLabel,
    })
  }
  const icon = chip.createSpan({ cls: 'scripture-study-chip-icon' })
  setIcon(icon, model.book === null ? 'book-open' : 'book-marked')
  activateAsButton(chip, (event) =>
    deps.openReference(model, { newPane: opensInNewPane(event) }),
  )
}

// The in-note intersection surface (spec §5): a count indicator beside the
// rendered reference that expands to the intersecting notes, annotations
// grouped first, then mentions. The list is re-queried on every expand so it
// stays fresh without subscribing the static note DOM to index changes.
const renderIntersections = (
  parent: HTMLElement,
  model: ReferenceRenderModel,
  intersections: NoteIntersectionSource,
  sourcePath: string | null,
): void => {
  const intersectingGroups = (): OccurrenceGroup[] =>
    intersections
      .intersecting(model.reference)
      .filter((group) => group.file !== sourcePath)
  const groups = intersectingGroups()
  if (groups.length === 0) return

  const holder = parent.createSpan({ cls: 'scripture-study-intersections' })
  const toggle = holder.createSpan({
    cls: 'scripture-study-intersections-toggle',
    attr: {
      role: 'button',
      tabindex: 0,
      'aria-label': 'Show intersecting notes',
      'aria-expanded': 'false',
    },
  })
  const annotationCount = groups.filter(isAnnotation).length
  const mentionCount = groups.length - annotationCount
  if (annotationCount > 0) {
    toggle.createSpan({
      cls: 'scripture-study-intersections-annotation-count',
      text: `●${annotationCount}`,
    })
  }
  if (mentionCount > 0) {
    toggle.createSpan({
      cls: 'scripture-study-intersections-mention-count',
      text: `◆${mentionCount}`,
    })
  }

  let panel: HTMLElement | null = null
  const renderGroupList = (
    into: HTMLElement,
    label: string,
    listed: OccurrenceGroup[],
    entryText: (file: string) => string,
  ): void => {
    if (listed.length === 0) return
    into.createSpan({ cls: 'scripture-study-intersections-group', text: label })
    for (const group of listed) {
      const entry = into.createSpan({
        cls: 'scripture-study-intersections-note',
        attr: { role: 'button', tabindex: 0 },
        text: entryText(group.file),
      })
      activateAsButton(entry, () => intersections.openNote(group.file))
    }
  }
  activateAsButton(toggle, () => {
    if (panel !== null) {
      panel.remove()
      panel = null
      toggle.setAttribute('aria-expanded', 'false')
      return
    }
    panel = holder.createSpan({ cls: 'scripture-study-intersections-panel' })
    const fresh = intersectingGroups()
    renderGroupList(
      panel,
      'Annotations',
      fresh.filter(isAnnotation),
      noteTitle,
    )
    renderGroupList(
      panel,
      'Mentions',
      fresh.filter((group) => !isAnnotation(group)),
      (file) => file,
    )
    toggle.setAttribute('aria-expanded', 'true')
  })
}

const renderInvalidTokens = (
  parent: HTMLElement,
  model: ReferenceRenderModel,
): void => {
  if (model.invalidTokens.length === 0) return
  const holder = parent.createSpan({ cls: 'scripture-study-invalid-tokens' })
  for (const token of model.invalidTokens) {
    holder.createSpan({ cls: 'scripture-study-invalid-token', text: token })
  }
}

const renderSegment = (parent: HTMLElement, segment: VerseSegment): void => {
  const indented = segment.lineStart === true && segment.indent !== undefined
  const classes = [
    ...(segment.highlightSlot === undefined
      ? []
      : [
          'scripture-study-highlight',
          `scripture-study-highlight-${segment.highlightSlot}`,
        ]),
    ...(segment.redLetter ? ['scripture-study-red-letter'] : []),
    ...(segment.supplied ? ['scripture-study-supplied'] : []),
    ...(segment.psalmHeading ? ['scripture-study-psalm-heading'] : []),
    ...(indented ? [`scripture-study-indent-${segment.indent}`] : []),
  ]
  if (classes.length > 0) {
    parent.createSpan({ cls: classes.join(' '), text: segment.text })
  } else {
    parent.appendChild(parent.ownerDocument.createTextNode(segment.text))
  }
}

// A Book atom flattened from a printed table prints as the grid it was, the
// header row as headings. Each cell reads its own stretch of the atom's
// segments, so a Ref Span link or a highlight inside a cell renders there as
// it does in prose.
const renderTable = (
  holder: HTMLElement,
  rows: NonNullable<PassageView['verses'][number]['table']>,
  segments: VerseSegment[],
): void => {
  const table = holder.createEl('table', { cls: 'scripture-study-table' })
  for (const row of rows) {
    const line = table.createEl('tr')
    for (const cell of row.cells) {
      const holderCell = line.createEl(row.header ? 'th' : 'td')
      for (const segment of spanSegments(segments, cell))
        renderSegment(holderCell, segment)
    }
  }
}

const renderSegments = (parent: HTMLElement, block: PassageView['verses'][number]): void => {
  if (block.label !== null) {
    parent.createEl('sup', {
      cls: 'scripture-study-verse-number',
      text: block.label,
    })
  }
  // The verse text lives in its own holder so a drag can be mapped back to
  // character offsets in this verse, with the number and chrome left out. A
  // table's cells are runs of their own — the separators between them print
  // as the grid rather than as text — so its holder carries no verse id and
  // stays out of the highlight surface. Cues already stored still paint: they
  // are marked onto the segments before a cell ever reads them.
  const holder = parent.createSpan({
    cls: VERSE_TEXT_CLASS,
    ...(block.table === null
      ? { attr: { 'data-verse-id': block.verseId } }
      : {}),
  })
  if (block.table !== null) {
    renderTable(holder, block.table, block.segments)
    return
  }
  for (const segment of block.segments) {
    if (segment.lineBreakBefore) holder.createEl('br')
    renderSegment(holder, segment)
  }
}

const renderFallbackNotice = (host: HTMLElement, view: PassageView): void => {
  if (view.fallbackNotice === null) return
  host.createSpan({
    cls: 'scripture-study-fallback-notice',
    text: view.fallbackNotice,
  })
}

const renderInstallCta = (
  host: HTMLElement,
  firstRun: FirstRunInstallDeps,
): void => {
  const cta = host.createSpan({
    cls: 'scripture-study-install-cta',
    attr: { role: 'button', tabindex: 0 },
    text: `Install ${firstRun.translationName}`,
  })
  let errorLine: HTMLElement | null = null
  let installing = false
  activateAsButton(cta, () => {
    if (installing) return
    installing = true
    cta.setText(`Installing ${firstRun.translationName}…`)
    cta.setAttribute('aria-disabled', 'true')
    errorLine?.remove()
    errorLine = null
    firstRun.install().catch((error: unknown) => {
      installing = false
      cta.setText(`Install ${firstRun.translationName}`)
      cta.removeAttribute('aria-disabled')
      errorLine = host.createSpan({
        cls: 'scripture-study-install-error',
        text: `Install failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      })
    })
  })
}

const renderUnavailable = (
  host: HTMLElement,
  model: ReferenceRenderModel,
  deps: ReferenceRenderDeps,
  retry: () => void,
): void => {
  const line = host.createSpan({
    cls: 'scripture-study-unavailable',
    text: unavailableText(model),
  })
  if (model.translationId === null && deps.firstRun !== undefined) {
    renderInstallCta(host, deps.firstRun)
    return
  }
  const retryIcon = line.createSpan({
    cls: 'scripture-study-retry',
    attr: { role: 'button', tabindex: 0, 'aria-label': 'Retry' },
  })
  setIcon(retryIcon, 'refresh-cw')
  activateAsButton(retryIcon, retry)
}

const mountPassage = async (
  host: HTMLElement,
  model: ReferenceRenderModel,
  deps: ReferenceRenderDeps,
  renderPassage: (host: HTMLElement, view: PassageView) => void,
): Promise<void> => {
  host.empty()
  host.addClass('scripture-study-loading')
  host.setText(loadingText(model))
  const passage: Passage =
    model.translationId === null
      ? { status: 'unavailable' }
      : await deps.passages.passage(model.reference, model.translationId)
  host.empty()
  host.removeClass('scripture-study-loading')
  if (passage.status !== 'ok' || passage.verses.length === 0) {
    renderUnavailable(host, model, deps, () => {
      void mountPassage(host, model, deps, renderPassage)
    })
    return
  }
  renderPassage(host, buildPassageView(model, passage))
  // Offsets index the requested translation's text, so a substituted passage
  // stays read-only.
  if (deps.editHighlights && passage.fallback === undefined) {
    deps.editHighlights(host, {
      cues: model.highlights,
      verses: passage.verses.map((verse) => ({
        verseId: verse.verseId,
        text: verse.segments.map((segment) => segment.text).join(''),
      })),
    })
  }
}

const renderAttribution = (host: HTMLElement, view: PassageView): void => {
  if (view.attribution === null) return
  host.createDiv({
    cls: 'scripture-study-attribution',
    text: view.attribution,
  })
}

// A book block has no chip (spec ticket #79): the citation line is the sole
// nav target, styled the same but wired with the chip's own click/keyboard
// activation and new-pane modifier handling.
const renderNavigableAttribution = (
  host: HTMLElement,
  view: PassageView,
  model: ReferenceRenderModel,
  deps: ReferenceRenderDeps,
): void => {
  if (view.attribution === null) return
  const attribution = host.createDiv({
    cls: 'scripture-study-attribution scripture-study-attribution-nav',
    text: view.attribution,
    attr: { role: 'button', tabindex: 0 },
  })
  activateAsButton(attribution, (event) =>
    deps.openReference(model, { newPane: opensInNewPane(event) }),
  )
}

// Scripture's `block` gives each verse its own line; a book atom is already a
// paragraph, so the same stack reads as prose instead (spec-books §4).
const renderVerseLines = (host: HTMLElement, view: PassageView): void => {
  renderFallbackNotice(host, view)
  for (const block of view.verses) {
    renderSegments(host.createDiv({ cls: 'scripture-study-verse-line' }), block)
  }
  renderAttribution(host, view)
}

const renderBookParagraphs =
  (model: ReferenceRenderModel, deps: ReferenceRenderDeps) =>
  (host: HTMLElement, view: PassageView): void => {
    renderFallbackNotice(host, view)
    for (const block of view.verses) {
      renderSegments(
        host.createDiv({ cls: 'scripture-study-book-paragraph' }),
        block,
      )
    }
    renderNavigableAttribution(host, view, model, deps)
  }

const renderVerseRun = (host: HTMLElement, view: PassageView): void => {
  renderFallbackNotice(host, view)
  view.verses.forEach((block, index) => {
    if (index > 0) {
      const previous = view.verses[index - 1]
      if (block.startsNewLine || previous.startsNewLine) host.createEl('br')
      else host.appendText(' ')
    }
    renderSegments(host, block)
  })
}

const renderBlock = (
  parent: HTMLElement,
  model: ReferenceRenderModel,
  deps: ReferenceRenderDeps,
  sourcePath: string | null,
): Promise<void> => {
  const inline = model.display === 'inline'
  // A book block's citation line is the nav target in place of the chip
  // (ticket #79); scripture blocks and inline atoms keep the chip.
  const isBookBlock = !inline && model.book !== null
  const block = parent.createDiv({
    cls: inline
      ? 'scripture-study-block scripture-study-inline-block'
      : 'scripture-study-block',
  })
  if (!isBookBlock) {
    const chipHolder = inline
      ? block
      : block.createDiv({ cls: 'scripture-study-block-ref' })
    renderChip(chipHolder, model, deps)
  }
  const host = inline
    ? block.createSpan({ cls: 'scripture-study-passage' })
    : block.createDiv({ cls: 'scripture-study-passage' })
  const renderPassage = inline
    ? renderVerseRun
    : model.book === null
      ? renderVerseLines
      : renderBookParagraphs(model, deps)
  const mounted = mountPassage(host, model, deps, renderPassage)
  if (deps.intersections) {
    renderIntersections(block, model, deps.intersections, sourcePath)
  }
  return mounted
}

export const renderReference = async (
  parent: HTMLElement,
  model: ReferenceRenderModel,
  deps: ReferenceRenderDeps,
  sourcePath: string | null = null,
): Promise<void> => {
  if (model.display !== 'chip') {
    await renderBlock(parent, model, deps, sourcePath)
    renderInvalidTokens(parent, model)
    return
  }
  renderChip(parent, model, deps)
  if (deps.intersections) {
    renderIntersections(parent, model, deps.intersections, sourcePath)
  }
  renderInvalidTokens(parent, model)
}
