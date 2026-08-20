import { WorkspaceLeaf, type Plugin } from 'obsidian'
import {
  NOOP_REFERENCE_NAVIGATOR,
  type NavigationOptions,
  type ReferenceNavigator,
  type WordStudyOpener,
  type WordStudyOptions,
} from '../contracts'
import { PluginFeature } from '../data-access'
import type { Reference } from '../reference'
import {
  INERT_WORD_STUDY_CONCORDANCE,
  INERT_WORD_STUDY_DICTIONARY,
  INERT_WORD_STUDY_LSJ,
  WordStudyModel,
  type WordStudyConcordance,
  type WordStudyDictionary,
  type WordStudyLsj,
  type WordStudyNavigator,
} from './word-study-model'
import { WORD_STUDY_VIEW_TYPE, WordStudyView } from './word-study-view'

export { WORD_STUDY_VIEW_TYPE } from './word-study-view'

export type WordStudyFeatureOptions = {
  dictionary?: WordStudyDictionary
  concordance?: WordStudyConcordance
  lsj?: WordStudyLsj
}

export class WordStudyFeature
  extends PluginFeature
  implements WordStudyOpener, WordStudyNavigator
{
  readonly #dictionary: WordStudyDictionary
  readonly #concordance: WordStudyConcordance
  readonly #lsj: WordStudyLsj
  readonly #models = new Set<WordStudyModel>()
  #navigator: ReferenceNavigator = NOOP_REFERENCE_NAVIGATOR
  // The panel a plain activation retargets: the one focused most recently, or
  // whichever is still open when none has been focused this session.
  #recent: WorkspaceLeaf | null = null

  constructor(plugin: Plugin, options: WordStudyFeatureOptions = {}) {
    super(plugin)
    this.#dictionary = options.dictionary ?? INERT_WORD_STUDY_DICTIONARY
    this.#concordance = options.concordance ?? INERT_WORD_STUDY_CONCORDANCE
    this.#lsj = options.lsj ?? INERT_WORD_STUDY_LSJ
  }

  // Where an occurrence row leads, wired once the reader exists.
  useNavigator(navigator: ReferenceNavigator): void {
    this.#navigator = navigator
  }

  openReference(
    reference: Reference,
    translationId: string | null,
    options?: NavigationOptions,
  ): void {
    this.#navigator.openReference(reference, translationId, options)
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
      concordance: this.#concordance,
      lsj: this.#lsj,
      opener: this,
      navigator: this,
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
    options: WordStudyOptions = {},
  ): Promise<void> {
    const workspace = this.plugin.app.workspace
    const leaf =
      (options.newPane === true ? null : this.#reusableLeaf()) ??
      workspace.getLeaf('tab')
    const translation = options.translationId ?? null
    await leaf.setViewState({
      type: WORD_STUDY_VIEW_TYPE,
      state: {
        strongs: strongsNumber,
        ...(translation === null ? {} : { translation }),
      },
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
