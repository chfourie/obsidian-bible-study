import { ItemView, WorkspaceLeaf, type ViewStateResult } from 'obsidian'
import { mount, unmount } from 'svelte'
import ReaderPane from './ReaderPane.svelte'
import type { ReaderFeature } from './reader-feature'
import type { ReaderPaneModel, ReaderPosition } from './reader-pane-model'

export const READER_VIEW_TYPE = 'scripture-study-reader'

// Redrawing a tab's own header is Obsidian's, and undeclared in its typings.
type HeaderedLeaf = WorkspaceLeaf & { updateHeader?: () => void }

type ReaderViewState = {
  book?: number
  chapter?: number
  redLetter?: 'off' | 'on'
}

export class ReaderView extends ItemView {
  // Chapter moves are recorded in the pane's history, so its back and forward
  // arrows walk them.
  override navigation = true
  readonly model: ReaderPaneModel
  #component: Record<string, unknown> | null = null
  // The open that this pane's own setViewState is waiting to apply. Set only
  // while Obsidian echoes a chapter move back through setState, so state
  // arriving from a layout restore or the arrows is told apart from the
  // pane's own navigation and never loops back into setViewState.
  #pendingOpen: (() => Promise<void>) | null = null
  #unsubscribe: (() => void) | null = null
  #titled: string | null = null

  constructor(
    leaf: WorkspaceLeaf,
    private readonly feature: ReaderFeature,
  ) {
    super(leaf)
    this.model = feature.createModel()
    this.model.useNavigation((position, open) => this.#navigate(position, open))
    this.#titled = this.model.view.title
    this.#unsubscribe = this.model.subscribe(() => this.#retitle())
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

  // A chapter opened straight on the model — the ribbon, a reference from the
  // panel — never passes through the leaf, so the tab keeps the title it was
  // opened with until the header is asked to read it again.
  #retitle(): void {
    const title = this.model.view.title
    if (title === this.#titled) return
    this.#titled = title
    ;(this.leaf as HeaderedLeaf).updateHeader?.()
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

  override async onClose(): Promise<void> {
    this.#unsubscribe?.()
    this.#unsubscribe = null
    this.feature.releaseModel(this.model)
    if (this.#component !== null) await unmount(this.#component)
    this.#component = null
  }
}
