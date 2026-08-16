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
    cls: 'bible-study-chip',
    attr: { role: 'button', tabindex: 0 },
  })
  chip.createSpan({ cls: 'bible-study-chip-ref', text: model.referenceText })
  if (model.chipLabel !== null) {
    chip.createSpan({
      cls: 'bible-study-chip-translation',
      text: model.chipLabel,
    })
  }
  const icon = chip.createSpan({ cls: 'bible-study-chip-icon' })
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

  const holder = parent.createSpan({ cls: 'bible-study-intersections' })
  const toggle = holder.createSpan({
    cls: 'bible-study-intersections-toggle',
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
      cls: 'bible-study-intersections-annotation-count',
      text: `●${annotationCount}`,
    })
  }
  if (mentionCount > 0) {
    toggle.createSpan({
      cls: 'bible-study-intersections-mention-count',
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
    into.createSpan({ cls: 'bible-study-intersections-group', text: label })
    for (const group of listed) {
      const entry = into.createSpan({
        cls: 'bible-study-intersections-note',
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
    panel = holder.createSpan({ cls: 'bible-study-intersections-panel' })
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
  const holder = parent.createSpan({ cls: 'bible-study-invalid-tokens' })
  for (const token of model.invalidTokens) {
    holder.createSpan({ cls: 'bible-study-invalid-token', text: token })
  }
}

const renderSegments = (parent: HTMLElement, block: PassageView['verses'][number]): void => {
  if (block.label !== null) {
    parent.createEl('sup', {
      cls: 'bible-study-verse-number',
      text: block.label,
    })
  }
  for (const segment of block.segments) {
    if (segment.redLetter) {
      parent.createSpan({ cls: 'bible-study-red-letter', text: segment.text })
    } else {
      parent.appendChild(parent.ownerDocument.createTextNode(segment.text))
    }
  }
}

const renderFallbackNotice = (host: HTMLElement, view: PassageView): void => {
  if (view.fallbackNotice === null) return
  host.createSpan({
    cls: 'bible-study-fallback-notice',
    text: view.fallbackNotice,
  })
}

const renderQuotedRun = (host: HTMLElement, view: PassageView): void => {
  renderFallbackNotice(host, view)
  host.appendText('“')
  view.verses.forEach((block, index) => {
    if (index > 0) host.appendText(' ')
    renderSegments(host, block)
  })
  host.appendText('”')
}

const renderInstallCta = (
  host: HTMLElement,
  firstRun: FirstRunInstallDeps,
): void => {
  const cta = host.createSpan({
    cls: 'bible-study-install-cta',
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
        cls: 'bible-study-install-error',
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
    cls: 'bible-study-unavailable',
    text: unavailableText(model),
  })
  if (model.translationId === null && deps.firstRun !== undefined) {
    renderInstallCta(host, deps.firstRun)
    return
  }
  const retryIcon = line.createSpan({
    cls: 'bible-study-retry',
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
  host.addClass('bible-study-loading')
  host.setText(loadingText(model))
  const passage: Passage =
    model.translationId === null
      ? { status: 'unavailable' }
      : await deps.passages.passage(model.reference, model.translationId)
  host.empty()
  host.removeClass('bible-study-loading')
  if (passage.status !== 'ok' || passage.verses.length === 0) {
    renderUnavailable(host, model, deps, () => {
      void mountPassage(host, model, deps, renderPassage)
    })
    return
  }
  renderPassage(host, buildPassageView(model, passage))
}

const renderInline = (
  parent: HTMLElement,
  model: ReferenceRenderModel,
  deps: ReferenceRenderDeps,
): Promise<void> => {
  const host = parent.createSpan({ cls: 'bible-study-passage' })
  return mountPassage(host, model, deps, renderQuotedRun)
}

const calloutTitle = (model: ReferenceRenderModel): string =>
  model.translationId === null
    ? model.referenceText
    : `${model.referenceText} · ${model.translationId.toUpperCase()}`

const renderProse = (host: HTMLElement, view: PassageView): void => {
  renderFallbackNotice(host, view)
  const prose = host.createEl('p', { cls: 'bible-study-prose' })
  view.verses.forEach((block, index) => {
    if (index > 0) prose.appendText(' ')
    renderSegments(prose, block)
  })
  if (view.attribution !== null) {
    host.createDiv({
      cls: 'bible-study-attribution',
      text: view.attribution,
    })
  }
}

const renderCallout = (
  parent: HTMLElement,
  model: ReferenceRenderModel,
  deps: ReferenceRenderDeps,
  sourcePath: string | null,
): Promise<void> => {
  const callout = parent.createDiv({
    cls: 'callout bible-study-callout',
    attr: { 'data-callout': 'bible' },
  })
  const title = callout.createDiv({ cls: 'callout-title' })
  const icon = title.createDiv({ cls: 'callout-icon' })
  setIcon(icon, 'book-open')
  title.createDiv({
    cls: 'callout-title-inner',
    text: calloutTitle(model),
  })
  const nav = title.createSpan({
    cls: 'bible-study-callout-nav',
    attr: { role: 'button', tabindex: 0, 'aria-label': 'Open in reader' },
  })
  setIcon(nav, 'arrow-right')
  activateAsButton(nav, () => deps.openReference(model))
  const content = callout.createDiv({ cls: 'callout-content' })
  const host = content.createDiv({ cls: 'bible-study-passage' })
  const mounted = mountPassage(host, model, deps, renderProse)
  if (deps.intersections) {
    renderIntersections(content, model, deps.intersections, sourcePath)
  }
  return mounted
}

export const renderReference = async (
  parent: HTMLElement,
  model: ReferenceRenderModel,
  deps: ReferenceRenderDeps,
  sourcePath: string | null = null,
): Promise<void> => {
  if (model.display === 'callout') {
    await renderCallout(parent, model, deps, sourcePath)
    renderInvalidTokens(parent, model)
    return
  }
  renderChip(parent, model, deps)
  if (deps.intersections) {
    renderIntersections(parent, model, deps.intersections, sourcePath)
  }
  renderInvalidTokens(parent, model)
  if (model.display === 'inline') await renderInline(parent, model, deps)
}
