import { ItemView, WorkspaceLeaf } from 'obsidian'
import { mount, unmount } from 'svelte'
import SearchPane from './SearchPane.svelte'
import type { SearchFeature } from './search-feature'
import type { SearchPaneModel } from './search-pane-model'

export const SEARCH_PANE_VIEW_TYPE = 'scripture-study-search'

export class SearchPaneView extends ItemView {
  readonly model: SearchPaneModel
  #component: Record<string, unknown> | null = null

  constructor(
    leaf: WorkspaceLeaf,
    private readonly feature: SearchFeature,
  ) {
    super(leaf)
    this.model = feature.createModel()
  }

  getViewType(): string {
    return SEARCH_PANE_VIEW_TYPE
  }

  getDisplayText(): string {
    return 'Search'
  }

  override getIcon(): string {
    return 'search'
  }

  override async onOpen(): Promise<void> {
    this.#component = mount(SearchPane, {
      target: this.contentEl,
      props: { model: this.model },
    }) as Record<string, unknown>
  }

  override async onClose(): Promise<void> {
    this.feature.releaseModel(this.model)
    if (this.#component !== null) await unmount(this.#component)
    this.#component = null
  }
}
