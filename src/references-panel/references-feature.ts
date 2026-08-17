import { TFile, WorkspaceLeaf, type Plugin } from 'obsidian'
import {
  NOOP_REFERENCE_NAVIGATOR,
  type ReferenceNavigator,
} from '../contracts'
import { PluginFeature } from '../data-access'
import type { ModuleStore } from '../modules'
import type { Reference } from '../reference'
import {
  ModulePassageSource,
  PassageRepository,
  renderContextFromSettings,
} from '../rendering'
import { extractOccurrences } from '../vault-index'
import {
  ReferencesPanelModel,
  type ActiveNote,
  type ReferencesPanelCrossReferences,
} from './references-panel-model'
import { REFERENCES_VIEW_TYPE, ReferencesView } from './references-view'

export { REFERENCES_VIEW_TYPE } from './references-view'

const INERT_CROSS_REFERENCES: ReferencesPanelCrossReferences = {
  intersecting: () => [],
  updateDescription: async () => {},
  removeMember: async () => ({ ok: true }),
  delete: async () => {},
}

export type ReferencesFeatureOptions = {
  crossReferences?: ReferencesPanelCrossReferences
  onCrossReferencesChanged?: (listener: () => void) => () => void
}

export class ReferencesFeature extends PluginFeature {
  readonly #repository: PassageRepository
  readonly #models = new Set<ReferencesPanelModel>()
  #active: ActiveNote | null = null
  #showToken = 0
  #navigator: ReferenceNavigator = NOOP_REFERENCE_NAVIGATOR
  readonly #crossReferences: ReferencesPanelCrossReferences
  readonly #onCrossReferencesChanged: (listener: () => void) => () => void
  #unsubscribeCrossReferences: (() => void) | null = null

  constructor(
    plugin: Plugin,
    store: ModuleStore,
    options: ReferencesFeatureOptions = {},
  ) {
    super(plugin)
    this.#repository = new PassageRepository(
      new ModulePassageSource(store, {
        derivedRedLetter: () => this.settings.derivedRedLetter,
      }),
    )
    this.#crossReferences = options.crossReferences ?? INERT_CROSS_REFERENCES
    this.#onCrossReferencesChanged = options.onCrossReferencesChanged ?? (() => () => {})
  }

  override async load(): Promise<void> {
    this.plugin.registerView(
      REFERENCES_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new ReferencesView(leaf, this),
    )
    this.plugin.addCommand({
      id: 'open-references-panel',
      name: 'Open references panel',
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
    this.plugin.registerEvent(
      this.plugin.app.metadataCache.on('changed', (file, content) =>
        this.#noteEdited(file.path, content),
      ),
    )
    // Cross-references are not notes: occurrence indexing does not apply, so
    // the store's own change feed is wired in explicitly (mirroring the
    // reader feature).
    this.#unsubscribeCrossReferences = this.#onCrossReferencesChanged(() =>
      this.#refreshCrossReferences(),
    )
    await this.#showFile(workspace.getActiveFile())
  }

  override unload(): void {
    this.#unsubscribeCrossReferences?.()
    this.#unsubscribeCrossReferences = null
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

  createModel(): ReferencesPanelModel {
    const model = new ReferencesPanelModel(
      {
        passages: this.#repository,
        extract: (content) =>
          extractOccurrences(content, {
            translationIds: renderContextFromSettings(this.settings)
              .knownTranslationIds,
          }),
        crossReferences: this.#crossReferences,
        growCrossReference: (id, members, description) =>
          this.#navigator.growCrossReference(
            id,
            members,
            description,
            this.settings.defaultTranslationId,
          ),
      },
      { translationId: this.settings.defaultTranslationId },
    )
    this.#models.add(model)
    void model.setActiveNote(this.#active)
    return model
  }

  releaseModel(model: ReferencesPanelModel): void {
    this.#models.delete(model)
  }

  useNavigator(navigator: ReferenceNavigator): void {
    this.#navigator = navigator
  }

  openReference(reference: Reference, translationId: string | null): void {
    this.#navigator.openReference(reference, translationId)
  }

  async openPanel(): Promise<void> {
    const workspace = this.plugin.app.workspace
    const existing = workspace.getLeavesOfType(REFERENCES_VIEW_TYPE)[0]
    if (existing) {
      await workspace.revealLeaf(existing)
      return
    }
    const leaf = workspace.getRightLeaf(false)
    if (leaf === null) return
    await leaf.setViewState({ type: REFERENCES_VIEW_TYPE, active: true })
    await workspace.revealLeaf(leaf)
  }

  async #showFile(file: TFile | null): Promise<void> {
    const token = ++this.#showToken
    const active =
      file === null
        ? null
        : { file: file.path, content: await this.plugin.app.vault.cachedRead(file) }
    if (token !== this.#showToken) return
    this.#active = active
    this.#fanOut()
  }

  #noteEdited(path: string, content: string): void {
    if (this.#active?.file !== path) return
    this.#active = { file: path, content }
    this.#fanOut()
  }

  #fanOut(): void {
    this.#models.forEach((model) => void model.setActiveNote(this.#active))
  }

  #refreshCrossReferences(): void {
    this.#models.forEach((model) => model.refreshCrossReferences())
  }
}
