import { setIcon } from 'obsidian'
import type { Reference } from '../reference'
import type { OccurrenceGroup } from '../vault-index'
import type { Passage, PassageSource } from './module-passage-source'
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

export type ReferenceRenderDeps = {
  passages: PassageSource
  openReference: (model: ReferenceRenderModel) => void
  intersections?: NoteIntersectionSource
  firstRun?: FirstRunInstallDeps
}

const activateAsButton = (element: HTMLElement, action: () => void): void => {
  element.addEventListener('click', action)
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    action()
  })
}

const renderChip = (
  parent: HTMLElement,
  model: ReferenceRenderModel,
  deps: ReferenceRenderDeps,
): void => {
  const chip = parent.createSpan({
    cls: 'scripture-study-chip',
    attr: { role: 'button', tabindex: 0 },
  })
  chip.createSpan({ cls: 'scripture-study-chip-ref', text: model.referenceText })
  if (model.chipLabel !== null) {
    chip.createSpan({
      cls: 'scripture-study-chip-translation',
      text: model.chipLabel,
    })
  }
  const icon = chip.createSpan({ cls: 'scripture-study-chip-icon' })
  setIcon(icon, 'book-open')
  activateAsButton(chip, () => deps.openReference(model))
}

const noteTitle = (file: string): string => {
  const basename = file.split('/').pop() ?? file
  return basename.replace(/\.md$/, '')
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
  const annotationCount = groups.filter((group) => group.annotation).length
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
      fresh.filter((group) => group.annotation),
      noteTitle,
    )
    renderGroupList(
      panel,
      'Mentions',
      fresh.filter((group) => !group.annotation),
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

const renderSegments = (parent: HTMLElement, block: PassageView['verses'][number]): void => {
  if (block.label !== null) {
    parent.createEl('sup', {
      cls: 'scripture-study-verse-number',
      text: block.label,
    })
  }
  for (const segment of block.segments) {
    if (segment.redLetter) {
      parent.createSpan({ cls: 'scripture-study-red-letter', text: segment.text })
    } else {
      parent.appendChild(parent.ownerDocument.createTextNode(segment.text))
    }
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
}

const renderAttribution = (host: HTMLElement, view: PassageView): void => {
  if (view.attribution === null) return
  host.createDiv({
    cls: 'scripture-study-attribution',
    text: view.attribution,
  })
}

const renderVerseLines = (host: HTMLElement, view: PassageView): void => {
  renderFallbackNotice(host, view)
  for (const block of view.verses) {
    renderSegments(host.createDiv({ cls: 'scripture-study-verse-line' }), block)
  }
  renderAttribution(host, view)
}

const renderVerseRun = (host: HTMLElement, view: PassageView): void => {
  renderFallbackNotice(host, view)
  view.verses.forEach((block, index) => {
    if (index > 0) host.appendText(' ')
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
  const block = parent.createDiv({
    cls: inline
      ? 'scripture-study-block scripture-study-inline-block'
      : 'scripture-study-block',
  })
  const chipHolder = inline
    ? block
    : block.createDiv({ cls: 'scripture-study-block-ref' })
  renderChip(chipHolder, model, deps)
  const host = inline
    ? block.createSpan({ cls: 'scripture-study-passage' })
    : block.createDiv({ cls: 'scripture-study-passage' })
  const mounted = mountPassage(
    host,
    model,
    deps,
    inline ? renderVerseRun : renderVerseLines,
  )
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
