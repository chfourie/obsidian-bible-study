import { TFile, WorkspaceLeaf, type Plugin } from 'obsidian'
import {
  NO_STUDY_MATERIAL,
  NOOP_REFERENCE_NAVIGATOR,
  type NavigationOptions,
  type ReferenceNavigator,
  type StudyMaterialProvider,
  type StudyMaterialSource,
} from '../contracts'
import {
  INERT_CROSS_REFERENCE_CATALOG,
  type CrossReference,
  type CrossReferenceCatalog,
} from '../cross-references'
import { PluginFeature } from '../data-access'
import type { ModuleStore } from '../modules'
import type { Reference } from '../reference'
import {
  ModulePassageSource,
  PassageRepository,
  renderContextFromSettings,
} from '../rendering'
import { extractOccurrences } from '../vault-index'
import { StudyPanelModel, type ActiveNote } from './study-panel-model'
import { STUDY_PANEL_VIEW_TYPE, StudyPanelView } from './study-panel-view'
import { TabMemory, type StudyTabState } from './tab-memory'

export { STUDY_PANEL_VIEW_TYPE } from './study-panel-view'

export type StudyPanelFeatureOptions = {
  crossReferences?: CrossReferenceCatalog
  studyMaterial?: StudyMaterialProvider
}

// The focused leaf's note, when it shows one. Reader tabs are not file views,
// so anything without a file is either a reader (resolved through the study
// material provider) or a leaf the panel ignores.
const focusedNote = (leaf: WorkspaceLeaf | null): TFile | null => {
  const file = (leaf?.view as { file?: unknown } | undefined)?.file
  return file instanceof TFile ? file : null
}

export class StudyPanelFeature extends PluginFeature {
  readonly #repository: PassageRepository
  readonly #models = new Set<StudyPanelModel>()
  #active: ActiveNote | null = null
  #showToken = 0
  #navigator: ReferenceNavigator = NOOP_REFERENCE_NAVIGATOR
  #annotator: (reference: Reference) => void = () => {}
  readonly #crossReferences: CrossReferenceCatalog
  readonly #studyMaterial: StudyMaterialProvider
  // The reader tab the panel mirrors, or null while a note holds focus.
  #material: StudyMaterialSource | null = null
  // The tab the panel follows, and the state every tab it has followed holds.
  #followed: WorkspaceLeaf | null = null
  // A tab that took focus without anything the panel could read on it — a
  // reader whose view was not in place yet — kept for another look.
  #unread: WorkspaceLeaf | null = null
  readonly #tabs = new TabMemory<WorkspaceLeaf>()
  #unsubscribeCrossReferences: (() => void) | null = null
  #unsubscribeSelection: (() => void) | null = null

  constructor(
    plugin: Plugin,
    store: ModuleStore,
    options: StudyPanelFeatureOptions = {},
  ) {
    super(plugin)
    this.#studyMaterial = options.studyMaterial ?? NO_STUDY_MATERIAL
    this.#repository = new PassageRepository(
      new ModulePassageSource(store, {
        derivedRedLetter: () => this.settings.derivedRedLetter,
      }),
    )
    this.#crossReferences =
      options.crossReferences ?? INERT_CROSS_REFERENCE_CATALOG
  }

  override async load(): Promise<void> {
    this.plugin.registerView(
      STUDY_PANEL_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new StudyPanelView(leaf, this),
    )
    this.plugin.addCommand({
      id: 'open-study-panel',
      name: 'Open study panel',
      callback: () => void this.openPanel(),
    })
    const workspace = this.plugin.app.workspace
    // A null file also fires when a non-file leaf gains focus — clicking
    // this very panel, say — so the last note is kept rather than blanked.
    this.plugin.registerEvent(
      workspace.on('file-open', (file) => {
        if (file !== null) void this.#showFile(file)
      }),
    )
    // Reader tabs carry no file, so following them takes the leaf itself.
    this.plugin.registerEvent(
      workspace.on('active-leaf-change', (leaf) => this.#focusLeaf(leaf)),
    )
    // Closing a tab is the only way its state ends: nothing outlives the tab,
    // and the panel has to let go of a tab it was following.
    this.plugin.registerEvent(
      workspace.on('layout-change', () => this.#layoutChanged()),
    )
    this.plugin.registerEvent(
      this.plugin.app.metadataCache.on('changed', (file, content) =>
        this.#noteEdited(file.path, content),
      ),
    )
    // Cross-references are not notes: occurrence indexing does not apply, so
    // the store's own change feed is wired in explicitly (mirroring the
    // reader feature).
    this.#unsubscribeCrossReferences = this.#crossReferences.onChanged(() =>
      this.#refreshCrossReferences(),
    )
    await this.#showFile(workspace.getActiveFile())
  }

  override unload(): void {
    this.#unsubscribeCrossReferences?.()
    this.#unsubscribeCrossReferences = null
    this.#followMaterial(null)
  }

  override onSettingsChanged(): void {
    this.#repository.clear()
    this.#models.forEach(
      (model) => void model.setTranslation(this.settings.defaultTranslationId),
    )
    // Installing a module can change which translation tokens parse, so the
    // active note is re-extracted too.
    this.#fanOut()
  }

  createModel(): StudyPanelModel {
    const model = new StudyPanelModel(
      {
        passages: this.#repository,
        extract: (content) =>
          extractOccurrences(content, {
            translationIds: renderContextFromSettings(this.settings)
              .knownTranslationIds,
          }),
        crossReferences: this.#crossReferences,
        editCrossReference: (entry, options) =>
          this.#navigator.editCrossReference(
            entry,
            this.settings.defaultTranslationId,
            options,
          ),
      },
      { translationId: this.settings.defaultTranslationId },
    )
    this.#models.add(model)
    model.showStudyMaterial(this.#material)
    model.useTabState(this.#followedState())
    void model.setActiveNote(this.#active)
    return model
  }

  releaseModel(model: StudyPanelModel): void {
    model.showStudyMaterial(null)
    model.useTabState(null)
    this.#models.delete(model)
  }

  useNavigator(navigator: ReferenceNavigator): void {
    this.#navigator = navigator
  }

  useAnnotator(annotator: (reference: Reference) => void): void {
    this.#annotator = annotator
  }

  annotateReference(reference: Reference): void {
    this.#annotator(reference)
  }

  openNote(file: string): void {
    this.#navigator.openNote(file)
  }

  editCrossReferenceInNewPane(entry: CrossReference): void {
    this.#navigator.editCrossReference(
      entry,
      this.settings.defaultTranslationId,
      { newPane: true },
    )
  }

  openReference(
    reference: Reference,
    translationId: string | null,
    options?: NavigationOptions,
  ): void {
    this.#navigator.openReference(reference, translationId, options)
  }

  async openPanel(): Promise<void> {
    const workspace = this.plugin.app.workspace
    const existing = workspace.getLeavesOfType(STUDY_PANEL_VIEW_TYPE)[0]
    if (existing) {
      await workspace.revealLeaf(existing)
      return
    }
    const leaf = workspace.getRightLeaf(false)
    if (leaf === null) return
    await leaf.setViewState({ type: STUDY_PANEL_VIEW_TYPE, active: true })
    await workspace.revealLeaf(leaf)
  }

  // Readers take the panel over; notes take it back; every other leaf — the
  // panel itself included — leaves the last view standing, which is what a
  // false return reports.
  #focusLeaf(leaf: WorkspaceLeaf | null): boolean {
    const followed = this.#follow(leaf)
    this.#unread = followed ? null : leaf
    return followed
  }

  #follow(leaf: WorkspaceLeaf | null): boolean {
    const material = this.#studyMaterial.studyMaterialFor(leaf?.view ?? null)
    if (material !== null) {
      // A note's read may still be in flight; taking the panel over cancels
      // it, or its completion would put the note back over this reader.
      this.#showToken += 1
      this.#followed = leaf
      this.#followMaterial(material)
      this.#models.forEach((model) => {
        model.showStudyMaterial(material)
        model.useTabState(this.#followedState())
      })
      return true
    }
    const file = focusedNote(leaf)
    if (file === null) return false
    this.#followed = leaf
    void this.#showFile(file)
    return true
  }

  // Tabs that have closed take their state with them; the panel then follows
  // whichever tab is now most recent, or shows its empty state if none is.
  #layoutChanged(): void {
    const workspace = this.plugin.app.workspace
    const live = new Set<WorkspaceLeaf>()
    workspace.iterateAllLeaves((leaf) => live.add(leaf))
    this.#tabs.retain(live)
    if (this.#followed !== null && !live.has(this.#followed)) {
      this.#followed = null
      this.#followMaterial(null)
      if (!this.#focusLeaf(workspace.getMostRecentLeaf()))
        void this.#showFile(null)
      return
    }
    // A reader that took focus before its view was in place looked like a
    // leaf the panel ignores; the layout settling is when it can be seen for
    // what it is.
    const unread = this.#unread
    if (unread !== null && live.has(unread)) this.#focusLeaf(unread)
  }

  // The panel mirrors one reader tab at a time, and listens for deliberate
  // selections there — the only material change allowed to reveal it.
  #followMaterial(source: StudyMaterialSource | null): void {
    if (source === this.#material) return
    this.#unsubscribeSelection?.()
    this.#material = source
    this.#unsubscribeSelection =
      source === null ? null : source.onSelection(() => this.#verseSelected())
  }

  #verseSelected(): void {
    if (this.settings.revealPanelOnSelection) void this.openPanel()
  }

  #followedState(): StudyTabState | null {
    return this.#followed === null ? null : this.#tabs.stateFor(this.#followed)
  }

  async #showFile(file: TFile | null): Promise<void> {
    const token = ++this.#showToken
    const active =
      file === null
        ? null
        : { file: file.path, content: await this.plugin.app.vault.cachedRead(file) }
    if (token !== this.#showToken) return
    this.#active = active
    this.#followMaterial(null)
    this.#fanOut()
  }

  #noteEdited(path: string, content: string): void {
    if (this.#active?.file !== path) return
    this.#active = { file: path, content }
    this.#fanOut()
  }

  #fanOut(): void {
    this.#models.forEach((model) => {
      model.showStudyMaterial(this.#material)
      model.useTabState(this.#followedState())
      void model.setActiveNote(this.#active)
    })
  }

  #refreshCrossReferences(): void {
    this.#models.forEach((model) => model.refreshCrossReferences())
  }
}
