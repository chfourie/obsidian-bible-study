import { WorkspaceLeaf, type Plugin } from 'obsidian'
import type { ReferenceNavigator } from '../contracts'
import { PluginFeature } from '../data-access'
import type { ModuleStore } from '../modules'
import type { Reference } from '../reference'
import { ModulePassageSource, PassageRepository } from '../rendering'
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
  #lastPosition: ReaderPosition = DEFAULT_POSITION

  constructor(
    plugin: Plugin,
    private readonly store: ModuleStore,
    private readonly index: VaultReferenceIndex,
  ) {
    super(plugin)
    this.#repository = new PassageRepository(new ModulePassageSource(store))
  }

  override async load(): Promise<void> {
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
      },
      {
        toggles: {
          details: this.settings.readerDetailsDefault,
          nav: this.settings.readerNavDefault,
          layout: this.settings.readerLayoutDefault,
        },
        translationId: this.settings.defaultTranslationId,
      },
    )
    model.subscribe(() => {
      this.#lastPosition = model.view.position
    })
    return model
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
