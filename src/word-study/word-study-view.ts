import { ItemView, WorkspaceLeaf, type ViewStateResult } from 'obsidian'
import { mount, unmount } from 'svelte'
import type { WordStudyFeature } from './word-study-feature'
import type { WordStudyModel } from './word-study-model'
import WordStudyPanel from './WordStudyPanel.svelte'

export const WORD_STUDY_VIEW_TYPE = 'scripture-study-word-study'

// Redrawing a tab's own header is Obsidian's, and undeclared in its typings.
type HeaderedLeaf = WorkspaceLeaf & { updateHeader?: () => void }

// All a Word Study Panel outlives its session with: the extended Strong's
// number it was opened on, and the translation its concordance reads.
type WordStudyViewState = { strongs?: string; translation?: string }

export class WordStudyView extends ItemView {
  // Retargeting a panel is a move the tab's back and forward arrows walk.
  override navigation = true
  readonly model: WordStudyModel
  #component: Record<string, unknown> | null = null
  #unsubscribe: (() => void) | null = null
  #titled: string

  constructor(
    leaf: WorkspaceLeaf,
    private readonly feature: WordStudyFeature,
  ) {
    super(leaf)
    this.model = feature.createModel()
    this.#titled = this.model.view.title
    this.#unsubscribe = this.model.subscribe(() => this.#retitle())
  }

  getViewType(): string {
    return WORD_STUDY_VIEW_TYPE
  }

  getDisplayText(): string {
    return this.model.view.title
  }

  override getIcon(): string {
    return 'languages'
  }

  override async onOpen(): Promise<void> {
    this.#component = mount(WordStudyPanel, {
      target: this.contentEl,
      props: { model: this.model },
    }) as Record<string, unknown>
  }

  override async setState(
    state: WordStudyViewState,
    result: ViewStateResult,
  ): Promise<void> {
    await super.setState(state, result)
    if (typeof state?.strongs !== 'string') return
    // Only a retarget onto a different number is a move worth walking back to.
    result.history = this.model.number !== null && this.model.number !== state.strongs
    await this.model.show(state.strongs, { translationId: state.translation ?? null })
  }

  override getState(): Record<string, unknown> {
    const number = this.model.number
    if (number === null) return {}
    const translation = this.model.translationId
    return {
      strongs: number,
      ...(translation === null ? {} : { translation }),
    }
  }

  // A panel retargeted onto another number keeps the title it was opened with
  // until the header is asked to read it again.
  #retitle(): void {
    const title = this.model.view.title
    if (title === this.#titled) return
    this.#titled = title
    ;(this.leaf as HeaderedLeaf).updateHeader?.()
  }

  override async onClose(): Promise<void> {
    this.#unsubscribe?.()
    this.#unsubscribe = null
    this.feature.releaseModel(this.model)
    if (this.#component !== null) await unmount(this.#component)
    this.#component = null
  }
}
