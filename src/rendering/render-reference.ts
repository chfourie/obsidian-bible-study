import { setIcon } from 'obsidian'
import type { PassageSource } from './module-passage-source'
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

export const renderReference = async (
  parent: HTMLElement,
  model: ReferenceRenderModel,
  deps: ReferenceRenderDeps,
): Promise<void> => {
  renderChip(parent, model, deps)
  renderInvalidTokens(parent, model)
}
