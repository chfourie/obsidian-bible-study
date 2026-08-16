import { ItemView, WorkspaceLeaf } from 'obsidian'
import { mount, unmount } from 'svelte'
import type { Reference } from '../reference'
import ReferencesPanel from './ReferencesPanel.svelte'
import type { ReferencesFeature } from './references-feature'
import type { ReferencesPanelModel } from './references-panel-model'

export const REFERENCES_VIEW_TYPE = 'scripture-study-references'

export class ReferencesView extends ItemView {
  readonly model: ReferencesPanelModel
  #component: Record<string, unknown> | null = null

  constructor(
    leaf: WorkspaceLeaf,
    private readonly feature: ReferencesFeature,
  ) {
    super(leaf)
    this.model = feature.createModel()
  }

  getViewType(): string {
    return REFERENCES_VIEW_TYPE
  }

  getDisplayText(): string {
    return 'Scripture references'
  }

  override getIcon(): string {
    return 'book-marked'
  }

  override async onOpen(): Promise<void> {
    this.#component = mount(ReferencesPanel, {
      target: this.contentEl,
      props: {
        model: this.model,
        openReference: (reference: Reference) =>
          this.feature.openReference(reference),
      },
    }) as Record<string, unknown>
  }

  override async onClose(): Promise<void> {
    this.feature.releaseModel(this.model)
    if (this.#component !== null) await unmount(this.#component)
    this.#component = null
  }
}
