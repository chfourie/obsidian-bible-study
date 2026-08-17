import { WorkspaceLeaf, type Plugin } from 'obsidian'
import type { ReferenceNavigator } from '../contracts'
import type { CrossReference, MemberRemoval } from '../cross-references'
import { PluginFeature } from '../data-access'
import { isTranslationManifest, type ModuleStore } from '../modules'
import { frontmatterLength, type Reference } from '../reference'
import { ModulePassageSource, PassageRepository } from '../rendering'
import type { VaultReferenceIndex } from '../vault-index'
import {
  ReaderPaneModel,
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

export type ReaderCrossReferences = {
  intersecting: (reference: Reference) => CrossReference[]
  create: (members: Reference[], description: string | null) => Promise<void>
  updateDescription: (id: string, description: string | null) => Promise<void>
  updateMembers: (id: string, members: Reference[]) => Promise<void>
  removeMember: (id: string, memberIndex: number) => Promise<MemberRemoval>
  delete: (id: string) => Promise<void>
  onChanged: (listener: () => void) => () => void
}

export type ReaderFeatureOptions = {
  indexRefreshDebounceMs?: number
  strongs?: ReaderStrongsDeps
  firstRun?: ReaderFirstRunDeps
  crossReferences?: ReaderCrossReferences
}

const INERT_CROSS_REFERENCES: ReaderCrossReferences = {
  intersecting: () => [],
  create: async () => {},
  updateDescription: async () => {},
  updateMembers: async () => {},
  removeMember: async () => ({ ok: true }),
  delete: async () => {},
  onChanged: () => () => {},
}

const INERT_STRONGS: ReaderStrongsDeps = {
  dictionariesInstalled: async () => false,
  entriesFor: async () => [],
  attribution: '',
}

export class ReaderFeature extends PluginFeature implements ReferenceNavigator {
  readonly #repositories: Record<'plain' | 'red', PassageRepository>
  readonly #models = new Set<ReaderPaneModel>()
  readonly #indexRefreshDebounceMs: number
  #pendingRefresh: number | null = null
  #unsubscribeIndex: (() => void) | null = null
  #unsubscribeCrossReferences: (() => void) | null = null
  #lastPosition: ReaderPosition = DEFAULT_POSITION
  #annotator: (reference: Reference) => void = () => {}
  readonly #strongs: ReaderStrongsDeps
  readonly #firstRun: ReaderFirstRunDeps | undefined
  readonly #crossReferences: ReaderCrossReferences

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
    this.#crossReferences = options.crossReferences ?? INERT_CROSS_REFERENCES
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
    model = new ReaderPaneModel(
      {
        passages: {
          passage: (reference, translationId) =>
            paneRepository().passage(reference, translationId),
        },
        availableTranslations: async () => this.#availableTranslations(),
        intersecting: (reference) =>
          this.index.intersectingOccurrences(reference),
        crossReferences: (reference) =>
          this.#crossReferences.intersecting(reference),
        createCrossReference: (members, description) =>
          this.#crossReferences.create(members, description),
        updateCrossReferenceDescription: (id, description) =>
          this.#crossReferences.updateDescription(id, description),
        updateCrossReferenceMembers: (id, members) =>
          this.#crossReferences.updateMembers(id, members),
        removeCrossReferenceMember: (id, memberIndex) =>
          this.#crossReferences.removeMember(id, memberIndex),
        deleteCrossReference: (id) => this.#crossReferences.delete(id),
        annotationDetails: (file) => this.#annotationDetails(file),
        strongs: this.#strongs,
        firstRun: this.#firstRun,
      },
      {
        toggles: {
          details: this.settings.readerDetailsDefault,
          nav: this.settings.readerNavDefault,
          layout: this.settings.readerLayoutDefault,
          strongs: this.settings.readerStrongsDefault,
          redLetter: this.settings.derivedRedLetter ? 'on' : 'off',
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

  useAnnotator(annotator: (reference: Reference) => void): void {
    this.#annotator = annotator
  }

  annotateReference(reference: Reference): void {
    this.#annotator(reference)
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

  openReference(reference: Reference, translationId: string | null): void {
    void this.#withReaderView((view) => view.model.openAt(reference, translationId))
  }

  growCrossReference(
    id: string,
    members: Reference[],
    description: string | null,
    translationId: string | null,
  ): void {
    if (members.length === 0) return
    void this.#withReaderView(async (view) => {
      await view.model.openAt(members[0], translationId)
      view.model.startEditingCrossReference(id, members, description)
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
