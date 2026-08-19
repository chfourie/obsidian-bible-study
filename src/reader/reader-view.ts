import { ItemView, WorkspaceLeaf, type ViewStateResult } from 'obsidian'
import { mount, unmount } from 'svelte'
import ReaderPane from './ReaderPane.svelte'
import type { ReaderFeature } from './reader-feature'
import type { ReaderPaneModel } from './reader-pane-model'

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
  readonly model: ReaderPaneModel
  #component: Record<string, unknown> | null = null
  #unsubscribeTitle: (() => void) | null = null
  #title: string

  constructor(
    leaf: WorkspaceLeaf,
    private readonly feature: ReaderFeature,
  ) {
    super(leaf)
    this.model = feature.createModel()
    this.#title = this.model.view.title
    this.#unsubscribeTitle = this.model.subscribe(() => this.#retitle())
  }

  getViewType(): string {
    return READER_VIEW_TYPE
  }

  getDisplayText(): string {
    return this.#title
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

  override async setState(
    state: ReaderViewState,
    result: ViewStateResult,
  ): Promise<void> {
    await super.setState(state, result)
    if (state?.redLetter === 'off' || state?.redLetter === 'on') {
      this.model.setToggle('redLetter', state.redLetter)
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

  #retitle(): void {
    const title = this.model.view.title
    if (title === this.#title) return
    this.#title = title
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
