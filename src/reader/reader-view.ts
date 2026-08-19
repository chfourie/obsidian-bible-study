import { ItemView, WorkspaceLeaf, type ViewStateResult } from 'obsidian'
import { mount, unmount } from 'svelte'
import ReaderPane from './ReaderPane.svelte'
import type { ReaderFeature } from './reader-feature'
import type { ReaderPaneModel, ReaderPosition } from './reader-pane-model'

export const READER_VIEW_TYPE = 'scripture-study-reader'

type ReaderViewState = {
  book?: number
  chapter?: number
  redLetter?: 'off' | 'on'
}

// Obsidian re-reads the tab title on a header refresh only, and updateHeader
// is runtime-only API the typings omit.
type HeaderRefreshingLeaf = WorkspaceLeaf & { updateHeader?: () => void }

export class ReaderView extends ItemView {
  // Chapter moves are recorded in the pane's history, so its back and forward
  // arrows walk them.
  override navigation = true
  readonly model: ReaderPaneModel
  #component: Record<string, unknown> | null = null
  #unsubscribeTitle: (() => void) | null = null
  // The title the header was last nudged for: only bookkeeping for the nudge,
  // never the answer getDisplayText gives.
  #nudgedTitle: string
  // The open that this pane's own setViewState is waiting to apply. Set only
  // while Obsidian echoes a chapter move back through setState, so state
  // arriving from a layout restore or the arrows is told apart from the
  // pane's own navigation and never loops back into setViewState.
  #pendingOpen: (() => Promise<void>) | null = null

  constructor(
    leaf: WorkspaceLeaf,
    private readonly feature: ReaderFeature,
  ) {
    super(leaf)
    this.model = feature.createModel()
    this.#nudgedTitle = this.model.view.title
    this.#unsubscribeTitle = this.model.subscribe(() => this.#nudgeHeader())
    this.model.useNavigation((position, open) => this.#navigate(position, open))
  }

  getViewType(): string {
    return READER_VIEW_TYPE
  }

  getDisplayText(): string {
    return this.model.view.title
  }

  override getIcon(): string {
    return 'book-open-text'
  }

  override async onOpen(): Promise<void> {
    this.#component = mount(ReaderPane, {
      target: this.contentEl,
      props: { model: this.model },
    }) as Record<string, unknown>
  }

  // Routes a chapter move through the leaf so Obsidian records it, and opens
  // it when the state comes back through setState.
  async #navigate(
    position: ReaderPosition,
    open: () => Promise<void>,
  ): Promise<void> {
    this.#pendingOpen = open
    try {
      await this.leaf.setViewState({
        type: READER_VIEW_TYPE,
        state: { ...this.getState(), ...position },
        active: true,
      })
    } finally {
      this.#pendingOpen = null
    }
  }

  override async setState(
    state: ReaderViewState,
    result: ViewStateResult,
  ): Promise<void> {
    await super.setState(state, result)
    if (state?.redLetter === 'off' || state?.redLetter === 'on') {
      this.model.setToggle('redLetter', state.redLetter)
    }
    const pendingOpen = this.#pendingOpen
    this.#pendingOpen = null
    // Only a chapter move the user asked for lands in the pane's history: not
    // the pane's first chapter, not a layout restore, not a replay of one.
    result.history = pendingOpen !== null && this.model.opened
    if (pendingOpen !== null) {
      await pendingOpen()
      return
    }
    if (typeof state?.book === 'number' && typeof state?.chapter === 'number') {
      await this.model.openPosition({
        book: state.book,
        chapter: state.chapter,
      })
    }
  }

  // Untouched panes omit the toggle so a reopened pane seeds from the
  // global setting instead of a frozen copy of it.
  override getState(): Record<string, unknown> {
    return {
      ...this.model.view.position,
      ...(this.model.redLetterOverridden
        ? { redLetter: this.model.view.toggles.redLetter }
        : {}),
    }
  }

  // Best effort: the header repaints promptly where the runtime offers the
  // call, and getDisplayText stays right where it does not.
  #nudgeHeader(): void {
    const title = this.model.view.title
    if (title === this.#nudgedTitle) return
    this.#nudgedTitle = title
    ;(this.leaf as HeaderRefreshingLeaf).updateHeader?.()
  }

  override async onClose(): Promise<void> {
    this.#unsubscribeTitle?.()
    this.#unsubscribeTitle = null
    this.feature.releaseModel(this.model)
    if (this.#component !== null) await unmount(this.#component)
    this.#component = null
  }
}
