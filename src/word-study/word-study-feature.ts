import { WorkspaceLeaf, type Plugin } from 'obsidian'
import type { NavigationOptions, WordStudyOpener } from '../contracts'
import { PluginFeature } from '../data-access'
import {
  INERT_WORD_STUDY_DICTIONARY,
  WordStudyModel,
  type WordStudyDictionary,
} from './word-study-model'
import { WORD_STUDY_VIEW_TYPE, WordStudyView } from './word-study-view'

export { WORD_STUDY_VIEW_TYPE } from './word-study-view'

export type WordStudyFeatureOptions = { dictionary?: WordStudyDictionary }

export class WordStudyFeature
  extends PluginFeature
  implements WordStudyOpener
{
  readonly #dictionary: WordStudyDictionary
  readonly #models = new Set<WordStudyModel>()
  // The panel a plain activation retargets: the one focused most recently, or
  // whichever is still open when none has been focused this session.
  #recent: WorkspaceLeaf | null = null

  constructor(plugin: Plugin, options: WordStudyFeatureOptions = {}) {
    super(plugin)
    this.#dictionary = options.dictionary ?? INERT_WORD_STUDY_DICTIONARY
  }

  override async load(): Promise<void> {
    this.plugin.registerView(
      WORD_STUDY_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new WordStudyView(leaf, this),
    )
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('active-leaf-change', (leaf) => {
        if (leaf?.view instanceof WordStudyView) this.#recent = leaf
      }),
    )
  }

  createModel(): WordStudyModel {
    const model = new WordStudyModel({
      dictionary: this.#dictionary,
      opener: this,
    })
    this.#models.add(model)
    return model
  }

  releaseModel(model: WordStudyModel): void {
    this.#models.delete(model)
  }

  // The study-material contract's way into the panel: a plain activation
  // takes over the panel already on screen, a Cmd/Ctrl-activation opens
  // another beside it. Mobile has no modifier, so it only ever reuses.
  async openWordStudy(
    strongsNumber: string,
    options: NavigationOptions = {},
  ): Promise<void> {
    const workspace = this.plugin.app.workspace
    const leaf =
      (options.newPane === true ? null : this.#reusableLeaf()) ??
      workspace.getLeaf('tab')
    await leaf.setViewState({
      type: WORD_STUDY_VIEW_TYPE,
      state: { strongs: strongsNumber },
      active: true,
    })
    await workspace.revealLeaf(leaf)
    await leaf.loadIfDeferred()
    this.#recent = leaf
  }

  #reusableLeaf(): WorkspaceLeaf | null {
    const open = this.plugin.app.workspace.getLeavesOfType(WORD_STUDY_VIEW_TYPE)
    const recent = this.#recent
    if (recent !== null && open.includes(recent)) return recent
    this.#recent = null
    return open[0] ?? null
  }
}
