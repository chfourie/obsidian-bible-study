import { Platform, WorkspaceLeaf, type Plugin } from 'obsidian'
import {
  NOOP_REFERENCE_NAVIGATOR,
  type NavigationOptions,
  type ReferenceNavigator,
} from '../contracts'
import {
  installedTranslationModuleIds,
  PluginFeature,
  type ReaderDevice,
  type SettingsStore,
} from '../data-access'
import type { ModuleStore } from '../modules'
import { BOOKS, registeredBooks, type Reference } from '../reference'
import { resolveFallbackTranslationId } from '../rendering'
import { SearchEngine } from './search-engine'
import { SearchPaneModel } from './search-pane-model'
import { SEARCH_PANE_VIEW_TYPE, SearchPaneView } from './search-pane-view'
import {
  resolveSearchScope,
  storedSearchScope,
  type SearchScope,
  type SearchScopeOptions,
  type StoredSearchScope,
} from './search-scope'

export { SEARCH_PANE_VIEW_TYPE } from './search-pane-view'

// Canonical Grid order is the order a translation's index build walks: OT 1-39
// then NT 40-66. A Book module indexes its own book instead, which the engine
// reads from its manifest.
const SCRIPTURE_BOOKS: readonly number[] = BOOKS.map((book) => book.id)

const currentDevice = (): ReaderDevice =>
  Platform.isMobile ? 'mobile' : 'desktop'

export class SearchFeature extends PluginFeature {
  readonly #models = new Set<SearchPaneModel>()
  readonly #engine: SearchEngine
  // The scope as the picker last left it, ahead of the settings write that
  // persists it — the pane must not wait on the filesystem to redraw.
  #chosen: StoredSearchScope | null = null
  #navigator: ReferenceNavigator = NOOP_REFERENCE_NAVIGATOR

  constructor(
    plugin: Plugin,
    store: ModuleStore,
    private readonly settingsStore: SettingsStore,
  ) {
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
      scopeOptions: () => this.#scopeOptions(),
      scope: () => this.#scope(),
      chooseScope: (scope: SearchScope) => this.#chooseScope(scope),
      search: (moduleId, query, onProgress) =>
        this.#engine.search(moduleId, query, onProgress),
      openHit: (
        reference: Reference,
        translationId: string | null,
        options?: NavigationOptions,
      ) => this.#navigator.openReference(reference, translationId, options),
    })
    this.#models.add(model)
    return model
  }

  releaseModel(model: SearchPaneModel): void {
    this.#models.delete(model)
  }

  // Installed translations name themselves by their module id; a Book names
  // itself as the Book Registry has it, and is offered only while both its
  // module is installed and its manifest is registered.
  #scopeOptions(): SearchScopeOptions {
    const installed = this.settings.installedModuleIds
    return {
      translations: installedTranslationModuleIds(this.settings).map((id) => ({
        id,
        label: id.toUpperCase(),
      })),
      books: registeredBooks()
        .filter((book) => installed.includes(book.moduleId))
        .map((book) => ({
          moduleId: book.moduleId,
          bookId: book.id,
          label: book.name,
        })),
      fallbackTranslationId: resolveFallbackTranslationId(this.settings),
    }
  }

  #scope(): SearchScope {
    const remembered =
      this.#chosen ?? this.settings.searchScope[currentDevice()]
    return resolveSearchScope(remembered, this.#scopeOptions())
  }

  #chooseScope(scope: SearchScope): void {
    const chosen = storedSearchScope(scope, this.#scopeOptions())
    this.#chosen = chosen
    void this.settingsStore.updateSettings((settings) => ({
      ...settings,
      searchScope: { ...settings.searchScope, [currentDevice()]: chosen },
    }))
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
