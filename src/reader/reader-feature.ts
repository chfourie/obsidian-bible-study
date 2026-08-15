import { WorkspaceLeaf, type Plugin } from 'obsidian'
import type { ReferenceNavigator } from '../contracts'
import { PluginFeature } from '../data-access'
import type { ModuleStore } from '../modules'
import { frontmatterLength, type Reference } from '../reference'
import {
  ModulePassageSource,
  PassageRepository,
  TieredPassageSource,
  type PassageSource,
} from '../rendering'
import type { VaultReferenceIndex } from '../vault-index'
import {
  ReaderPaneModel,
  type ReaderPosition,
} from './reader-pane-model'
import { READER_VIEW_TYPE, ReaderView } from './reader-view'

export { READER_VIEW_TYPE } from './reader-view'

const DEFAULT_POSITION: ReaderPosition = { book: 43, chapter: 1 }

export class ReaderFeature extends PluginFeature implements ReferenceNavigator {
  readonly #repository: PassageRepository
  readonly #models = new Set<ReaderPaneModel>()
  #unsubscribeIndex: (() => void) | null = null
  #lastPosition: ReaderPosition = DEFAULT_POSITION

  constructor(
    plugin: Plugin,
    private readonly store: ModuleStore,
    private readonly index: VaultReferenceIndex,
    onlineSource?: PassageSource,
  ) {
    super(plugin)
    const moduleSource = new ModulePassageSource(store)
    // The reader's stacked view never substitutes the fallback translation
    // (spec §6.4), so tiers compose here without a FallbackPassageSource.
    this.#repository = new PassageRepository(
      onlineSource
        ? new TieredPassageSource(moduleSource, onlineSource)
        : moduleSource,
    )
  }

  override async load(): Promise<void> {
    this.#unsubscribeIndex = this.index.onChanged(() => {
      this.#models.forEach((model) => void model.refreshOccurrences())
    })
    this.plugin.registerView(
      READER_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new ReaderView(leaf, this),
    )
    this.plugin.addCommand({
      id: 'open-reader',
      name: 'Open reader',
      callback: () => void this.openReader(),
    })
    this.plugin.addRibbonIcon(
      'book-open-text',
      'Open Bible Study reader',
      () => void this.openReader(),
    )
  }

  override unload(): void {
    this.#unsubscribeIndex?.()
    this.#unsubscribeIndex = null
  }

  override onSettingsChanged(): void {
    this.#repository.clear()
  }

  createModel(): ReaderPaneModel {
    const model = new ReaderPaneModel(
      {
        passages: this.#repository,
        installedTranslations: () => this.store.installedManifests(),
        intersecting: (reference) =>
          this.index.intersectingOccurrences(reference),
        annotationDetails: (file) => this.#annotationDetails(file),
      },
      {
        toggles: {
          details: this.settings.readerDetailsDefault,
          nav: this.settings.readerNavDefault,
          layout: this.settings.readerLayoutDefault,
        },
        translationId: this.settings.defaultTranslationId,
        annotationOrdering: this.settings.annotationOrdering,
      },
    )
    model.subscribe(() => {
      this.#lastPosition = model.view.position
    })
    this.#models.add(model)
    return model
  }

  releaseModel(model: ReaderPaneModel): void {
    this.#models.delete(model)
  }

  async #annotationDetails(
    file: string,
  ): Promise<{ body: string; created: number } | null> {
    const vault = this.plugin.app.vault
    const noteFile = vault.getFileByPath(file)
    if (noteFile === null) return null
    const content = await vault.cachedRead(noteFile)
    return {
      body: content.slice(frontmatterLength(content)),
      created: noteFile.stat.ctime,
    }
  }

  prefillReference(): Reference | null {
    const leaf = this.plugin.app.workspace.getLeavesOfType(READER_VIEW_TYPE)[0]
    if (!leaf || !(leaf.view instanceof ReaderView)) return null
    const model = leaf.view.model
    return model.selectionReference() ?? model.currentChapterReference()
  }

  openNote(file: string): void {
    void this.plugin.app.workspace.openLinkText(file, '', true)
  }

  openReference(reference: Reference, translationId: string | null): void {
    void this.#withReaderView((view) => view.model.openAt(reference, translationId))
  }

  async openReader(): Promise<void> {
    const workspace = this.plugin.app.workspace
    const existing = workspace.getLeavesOfType(READER_VIEW_TYPE)[0]
    if (existing) {
      await workspace.revealLeaf(existing)
      return
    }
    const lastPosition = this.#lastPosition
    await this.#withReaderView((view) => view.model.openPosition(lastPosition))
  }

  async #withReaderView(
    action: (view: ReaderView) => Promise<void>,
  ): Promise<void> {
    const workspace = this.plugin.app.workspace
    let leaf = workspace.getLeavesOfType(READER_VIEW_TYPE)[0]
    if (!leaf) {
      leaf = workspace.getLeaf('tab')
      await leaf.setViewState({ type: READER_VIEW_TYPE, active: true })
    }
    await workspace.revealLeaf(leaf)
    await leaf.loadIfDeferred()
    if (leaf.view instanceof ReaderView) await action(leaf.view)
  }
}
