import {
  ItemView,
  MarkdownRenderer,
  WorkspaceLeaf,
  type ViewStateResult,
} from 'obsidian'
import { mount, unmount } from 'svelte'
import type { Reference } from '../reference'
import ReaderPane from './ReaderPane.svelte'
import type { ReaderFeature } from './reader-feature'
import type { ReaderPaneModel } from './reader-pane-model'

export const READER_VIEW_TYPE = 'scripture-study-reader'

type ReaderViewState = {
  book?: number
  chapter?: number
}

export class ReaderView extends ItemView {
  readonly model: ReaderPaneModel
  #component: Record<string, unknown> | null = null

  constructor(
    leaf: WorkspaceLeaf,
    private readonly feature: ReaderFeature,
  ) {
    super(leaf)
    this.model = feature.createModel()
  }

  getViewType(): string {
    return READER_VIEW_TYPE
  }

  getDisplayText(): string {
    return 'Scripture Study reader'
  }

  override getIcon(): string {
    return 'book-open-text'
  }

  override async onOpen(): Promise<void> {
    this.#component = mount(ReaderPane, {
      target: this.contentEl,
      props: {
        model: this.model,
        openNote: (file: string) => this.feature.openNote(file),
        onAnnotate: (reference: Reference) =>
          this.feature.annotateReference(reference),
        renderMarkdown: (el: HTMLElement, markdown: string, sourcePath: string) =>
          void MarkdownRenderer.render(this.app, markdown, el, sourcePath, this),
      },
    }) as Record<string, unknown>
  }

  override async setState(
    state: ReaderViewState,
    result: ViewStateResult,
  ): Promise<void> {
    await super.setState(state, result)
    if (typeof state?.book === 'number' && typeof state?.chapter === 'number') {
      await this.model.openPosition({
        book: state.book,
        chapter: state.chapter,
      })
    }
  }

  override getState(): Record<string, unknown> {
    return { ...this.model.view.position }
  }

  override async onClose(): Promise<void> {
    this.feature.releaseModel(this.model)
    if (this.#component !== null) await unmount(this.#component)
    this.#component = null
  }
}
