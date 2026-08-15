import { setIcon } from 'obsidian'
import type { Passage, PassageSource } from './module-passage-source'
import {
  buildPassageView,
  loadingText,
  unavailableText,
  type PassageView,
} from './passage-view'
import type { ReferenceRenderModel } from './reference-render-model'

export type ReferenceRenderDeps = {
  passages: PassageSource
  openReference: (model: ReferenceRenderModel) => void
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
  chip.addEventListener('click', () => deps.openReference(model))
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

const renderQuotedRun = (host: HTMLElement, view: PassageView): void => {
  host.appendText('“')
  view.verses.forEach((block, index) => {
    if (index > 0) host.appendText(' ')
    renderSegments(host, block)
  })
  host.appendText('”')
}

const renderUnavailable = (
  host: HTMLElement,
  model: ReferenceRenderModel,
  retry: () => void,
): void => {
  const line = host.createSpan({
    cls: 'bible-study-unavailable',
    text: unavailableText(model),
  })
  const retryIcon = line.createSpan({
    cls: 'bible-study-retry',
    attr: { role: 'button', tabindex: 0, 'aria-label': 'Retry' },
  })
  setIcon(retryIcon, 'refresh-cw')
  retryIcon.addEventListener('click', retry)
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
    renderUnavailable(host, model, () => {
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

export const renderReference = async (
  parent: HTMLElement,
  model: ReferenceRenderModel,
  deps: ReferenceRenderDeps,
): Promise<void> => {
  renderChip(parent, model, deps)
  renderInvalidTokens(parent, model)
  if (model.display === 'inline') await renderInline(parent, model, deps)
}
