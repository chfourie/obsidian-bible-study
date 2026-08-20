import { WorkspaceLeaf, type Plugin } from 'obsidian'
import {
  NOOP_REFERENCE_NAVIGATOR,
  type NavigationOptions,
  type ReferenceNavigator,
} from '../contracts'
import { PluginFeature } from '../data-access'
import type { ModuleStore } from '../modules'
import { BOOKS, type Reference } from '../reference'
import { resolveFallbackTranslationId } from '../rendering'
import { SearchEngine } from './search-engine'
import { SearchPaneModel, type SearchTranslation } from './search-pane-model'
import { SEARCH_PANE_VIEW_TYPE, SearchPaneView } from './search-pane-view'

export { SEARCH_PANE_VIEW_TYPE } from './search-pane-view'

// Canonical Grid order is the order the index build walks: OT 1-39 then NT
// 40-66. Books (≥ 101) join this list when the scope picker can select them.
const SCRIPTURE_BOOKS: readonly number[] = BOOKS.map((book) => book.id)

export class SearchFeature extends PluginFeature {
  readonly #models = new Set<SearchPaneModel>()
  readonly #engine: SearchEngine
  #navigator: ReferenceNavigator = NOOP_REFERENCE_NAVIGATOR

  constructor(plugin: Plugin, store: ModuleStore) {
    super(plugin)
    this.#engine = new SearchEngine(store, SCRIPTURE_BOOKS)
  }

  override async load(): Promise<void> {
    this.plugin.registerView(
      SEARCH_PANE_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new SearchPaneView(leaf, this),
    )
    this.plugin.addCommand({
      id: 'open-search',
      name: 'Open search',
      callback: () => void this.openPane(),
    })
  }

  // Unlike the Study Panel, the Search Pane subscribes to no workspace
  // events at all: what it shows is what was searched, whatever tab has
  // focus.
  override onSettingsChanged(): void {
    this.#models.forEach((model) => model.refresh())
  }

  useNavigator(navigator: ReferenceNavigator): void {
    this.#navigator = navigator
  }

  createModel(): SearchPaneModel {
    const model = new SearchPaneModel({
      translation: () => this.#translation(),
      search: (moduleId, query, onProgress) =>
        this.#engine.search(moduleId, query, onProgress),
      openHit: (
        reference: Reference,
        translationId: string,
        options?: NavigationOptions,
      ) => this.#navigator.openReference(reference, translationId, options),
    })
    this.#models.add(model)
    return model
  }

  releaseModel(model: SearchPaneModel): void {
    this.#models.delete(model)
  }

  // The scope picker lands in a later ticket; until then every query runs
  // against the Fallback Translation.
  #translation(): SearchTranslation | null {
    const id = resolveFallbackTranslationId(this.settings)
    return id === null ? null : { id, label: id.toUpperCase() }
  }

  async openPane(): Promise<void> {
    const workspace = this.plugin.app.workspace
    const existing = workspace.getLeavesOfType(SEARCH_PANE_VIEW_TYPE)[0]
    if (existing) {
      await workspace.revealLeaf(existing)
      return
    }
    const leaf = workspace.getRightLeaf(false)
    if (leaf === null) return
    await leaf.setViewState({ type: SEARCH_PANE_VIEW_TYPE, active: true })
    await workspace.revealLeaf(leaf)
  }
}
