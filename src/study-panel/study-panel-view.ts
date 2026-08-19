import { ItemView, WorkspaceLeaf } from 'obsidian'
import { mount, unmount } from 'svelte'
import type { NavigationOptions } from '../contracts'
import type { Reference } from '../reference'
import StudyPanel from './StudyPanel.svelte'
import type { StudyPanelFeature } from './study-panel-feature'
import type { StudyPanelModel } from './study-panel-model'

export const STUDY_PANEL_VIEW_TYPE = 'scripture-study-panel'

export class StudyPanelView extends ItemView {
  readonly model: StudyPanelModel
  #component: Record<string, unknown> | null = null

  constructor(
    leaf: WorkspaceLeaf,
    private readonly feature: StudyPanelFeature,
  ) {
    super(leaf)
    this.model = feature.createModel()
  }

  getViewType(): string {
    return STUDY_PANEL_VIEW_TYPE
  }

  getDisplayText(): string {
    return 'Study panel'
  }

  override getIcon(): string {
    return 'book-marked'
  }

  override async onOpen(): Promise<void> {
    this.#component = mount(StudyPanel, {
      target: this.contentEl,
      props: {
        model: this.model,
        openReference: (
          reference: Reference,
          translationId: string | null,
          options?: NavigationOptions,
        ) => this.feature.openReference(reference, translationId, options),
      },
    }) as Record<string, unknown>
  }

  override async onClose(): Promise<void> {
    this.feature.releaseModel(this.model)
    if (this.#component !== null) await unmount(this.#component)
    this.#component = null
  }
}
