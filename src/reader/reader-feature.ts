import { Platform, WorkspaceLeaf, type Plugin, type View } from 'obsidian'
import type {
  NavigationOptions,
  ReferenceNavigator,
  StudyMaterialProvider,
  StudyMaterialSource,
} from '../contracts'
import {
  INERT_CROSS_REFERENCE_CATALOG,
  type CrossReferenceCatalog,
  type CrossReference,
} from '../cross-references'
import { readAnnotationDetails } from '../annotations'
import { PluginFeature } from '../data-access'
import {
  isBookManifest,
  isTranslationManifest,
  type ModuleStore,
} from '../modules'
import type { Reference } from '../reference'
import { ModulePassageSource, PassageRepository } from '../rendering'
import type { VaultReferenceIndex } from '../vault-index'
import {
  ReaderPaneModel,
  type ReaderBook,
  type ReaderFirstRunDeps,
  type ReaderPosition,
  type ReaderStrongsDeps,
  type ReaderTranslation,
} from './reader-pane-model'
import { READER_VIEW_TYPE, ReaderView } from './reader-view'

export { READER_VIEW_TYPE } from './reader-view'

const DEFAULT_POSITION: ReaderPosition = { book: 43, chapter: 1 }

// Trailing debounce over index notifications: the startup vault scan and
// multi-file edits collapse into a single refresh per open pane.
const DEFAULT_INDEX_REFRESH_DEBOUNCE_MS = 100

export type ReaderFeatureOptions = {
  indexRefreshDebounceMs?: number
  strongs?: ReaderStrongsDeps
  firstRun?: ReaderFirstRunDeps
  crossReferences?: CrossReferenceCatalog
}

const INERT_STRONGS: ReaderStrongsDeps = {
  dictionariesInstalled: async () => false,
  entriesFor: async () => [],
  attribution: '',
}

export class ReaderFeature
  extends PluginFeature
  implements ReferenceNavigator, StudyMaterialProvider
{
  readonly #repositories: Record<'plain' | 'red', PassageRepository>
  readonly #models = new Set<ReaderPaneModel>()
  readonly #indexRefreshDebounceMs: number
  #pendingRefresh: number | null = null
  #unsubscribeIndex: (() => void) | null = null
  #unsubscribeCrossReferences: (() => void) | null = null
  #lastPosition: ReaderPosition = DEFAULT_POSITION
  readonly #strongs: ReaderStrongsDeps
  readonly #firstRun: ReaderFirstRunDeps | undefined
  readonly #crossReferences: CrossReferenceCatalog

  constructor(
    plugin: Plugin,
    private readonly store: ModuleStore,
    private readonly index: VaultReferenceIndex,
    options: ReaderFeatureOptions = {},
  ) {
    super(plugin)
    this.#indexRefreshDebounceMs =
      options.indexRefreshDebounceMs ?? DEFAULT_INDEX_REFRESH_DEBOUNCE_MS
    this.#strongs = options.strongs ?? INERT_STRONGS
    this.#firstRun = options.firstRun
    this.#crossReferences =
      options.crossReferences ?? INERT_CROSS_REFERENCE_CATALOG
    // The reader's stacked view never substitutes the fallback translation
    // (spec §6.3): unavailable translations show an unavailable row.
    // Panes pick between the two repositories per their red-letter toggle,
    // so the caches never mix derived-red and plain passages.
    this.#repositories = {
      plain: new PassageRepository(new ModulePassageSource(store)),
      red: new PassageRepository(
        new ModulePassageSource(store, { derivedRedLetter: () => true }),
      ),
    }
  }

  override async load(): Promise<void> {
    this.#unsubscribeIndex = this.index.onChanged(() =>
      this.#scheduleOccurrenceRefresh(),
    )
    this.#unsubscribeCrossReferences = this.#crossReferences.onChanged(() =>
      this.#scheduleOccurrenceRefresh(),
    )
    this.plugin.registerView(
      READER_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new ReaderView(leaf, this),
    )
    this.plugin.addCommand({
      id: 'open-reader',
      name: 'Open reader',
      callback: () => void this.openReader(),
    })
  }

  override unload(): void {
    this.#unsubscribeIndex?.()
    this.#unsubscribeIndex = null
    this.#unsubscribeCrossReferences?.()
    this.#unsubscribeCrossReferences = null
    if (this.#pendingRefresh !== null) {
      window.clearTimeout(this.#pendingRefresh)
      this.#pendingRefresh = null
    }
  }

  async #availableTranslations(): Promise<ReaderTranslation[]> {
    return (await this.store.installedManifests())
      .filter(isTranslationManifest)
      .map((manifest) => ({
        id: manifest.id,
        label: manifest.id.toUpperCase(),
        name: manifest.name,
        strongsTagged: manifest.capabilities.strongsTagged === true,
      }))
  }

  // A book's manifest carries its own contents table, so the reader learns
  // which books exist the same way everything else does — from what is
  // installed (ADR 0002).
  async #installedBooks(): Promise<ReaderBook[]> {
    return (await this.store.installedManifests())
      .filter(isBookManifest)
      .map((manifest) => ({
        number: manifest.book.number,
        title: manifest.name,
        author: manifest.book.author,
        year: manifest.book.year,
        editionId: manifest.id,
        sections: manifest.book.sections.map(({ chapter, name }) => ({
          chapter,
          name,
        })),
      }))
  }

  override onSettingsChanged(): void {
    this.#repositories.plain.clear()
    this.#repositories.red.clear()
    this.#models.forEach((model) => {
      model.setAnnotationOrdering(this.settings.annotationOrdering)
      model.setDefaultFontScale(this.settings.readerFontScalePercent)
      void model.refreshTranslations()
      model.setRedLetterDefault(this.settings.derivedRedLetter ? 'on' : 'off')
      // Panes with nothing on screen (no translation yet, or the passage was
      // unavailable) reload so a module installed from the settings tab
      // appears without reopening the pane.
      const status = model.view.status
      if (status === 'no-translation' || status === 'unavailable')
        void model.openPosition(model.view.position)
    })
  }

  #scheduleOccurrenceRefresh(): void {
    if (this.#pendingRefresh !== null) window.clearTimeout(this.#pendingRefresh)
    this.#pendingRefresh = window.setTimeout(() => {
      this.#pendingRefresh = null
      this.#models.forEach((model) => void model.refreshOccurrences())
    }, this.#indexRefreshDebounceMs)
  }

  createModel(): ReaderPaneModel {
    let model: ReaderPaneModel
    const paneRepository = (): PassageRepository =>
      this.#repositories[
        model.view.toggles.redLetter === 'on' ? 'red' : 'plain'
      ]
    // A new pane seeds from the device it opens on; in-pane toggling from
    // there is ephemeral and never writes back to either device's default.
    const device = Platform.isMobile ? 'mobile' : 'desktop'
    model = new ReaderPaneModel(
      {
        passages: {
          passage: (reference, translationId) =>
            paneRepository().passage(reference, translationId),
        },
        availableTranslations: async () => this.#availableTranslations(),
        intersecting: (reference) =>
          this.index.intersectingOccurrences(reference),
        crossReferences: this.#crossReferences,
        annotationDetails: (file) =>
          readAnnotationDetails(this.plugin.app.vault, file),
        strongs: this.#strongs,
        books: {
          installed: () => this.#installedBooks(),
          epigraphs: async (editionId, chapter) =>
            (await this.store.epigraphs(editionId))[chapter] ?? [],
        },
        newTab: (position) => void this.#openInNewTab(position),
        firstRun: this.#firstRun,
      },
      {
        toggles: {
          nav: this.settings.readerNavDefault[device],
          layout: this.settings.readerLayoutDefault[device],
          strongs: this.settings.readerStrongsDefault[device],
          redLetter: this.settings.derivedRedLetter ? 'on' : 'off',
          paraNumbers: this.settings.readerParaNumbersDefault[device],
        },
        translationId: this.settings.defaultTranslationId,
        annotationOrdering: this.settings.annotationOrdering,
        fontScalePercent: this.settings.readerFontScalePercent,
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

  studyMaterialFor(view: View | null): StudyMaterialSource | null {
    return view instanceof ReaderView ? view.model : null
  }

  prefillReference(): Reference | null {
    const leaf = this.plugin.app.workspace.getLeavesOfType(READER_VIEW_TYPE)[0]
    if (!leaf || !(leaf.view instanceof ReaderView)) return null
    const model = leaf.view.model
    return model.selectionReference() ?? model.currentChapterReference()
  }

  openNote(file: string): void {
    void this.plugin.app.workspace.openLinkText(file, '', 'split')
  }

  openReference(
    reference: Reference,
    translationId: string | null,
    options: NavigationOptions = {},
  ): void {
    void this.#withReaderView(
      (view) => view.model.openAt(reference, translationId),
      options,
    )
  }

  editCrossReference(
    entry: CrossReference,
    translationId: string | null,
    options: NavigationOptions = {},
  ): void {
    if (entry.members.length === 0) return
    void this.#withReaderView(async (view) => {
      await view.model.openAt(entry.members[0], translationId)
      view.model.startEditingCrossReference(entry)
    }, options)
  }

  // The seam a mod-clicked nav target travels: a fresh leaf opened straight
  // at the position, so it starts its own history there and the pane that
  // asked keeps both its position and its history.
  async #openInNewTab(position: ReaderPosition): Promise<void> {
    await this.#withReaderView((view) => view.model.openPosition(position), {
      newPane: true,
    })
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
    options: NavigationOptions = {},
  ): Promise<void> {
    const workspace = this.plugin.app.workspace
    let leaf = options.newPane
      ? undefined
      : workspace.getLeavesOfType(READER_VIEW_TYPE)[0]
    if (!leaf) {
      leaf = workspace.getLeaf('tab')
      await leaf.setViewState({ type: READER_VIEW_TYPE, active: true })
    }
    await workspace.revealLeaf(leaf)
    await leaf.loadIfDeferred()
    if (leaf.view instanceof ReaderView) await action(leaf.view)
  }
}
