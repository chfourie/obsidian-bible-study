import { TFile, WorkspaceLeaf, type Plugin } from 'obsidian'
import {
  NOOP_REFERENCE_NAVIGATOR,
  type ReferenceNavigator,
} from '../contracts'
import { PluginFeature } from '../data-access'
import type { ModuleStore } from '../modules'
import type { Reference } from '../reference'
import { ModulePassageSource, PassageRepository } from '../rendering'
import { ReferencesPanelModel, type ActiveNote } from './references-panel-model'
import { REFERENCES_VIEW_TYPE, ReferencesView } from './references-view'

export { REFERENCES_VIEW_TYPE } from './references-view'

export class ReferencesFeature extends PluginFeature {
  readonly #repository: PassageRepository
  readonly #models = new Set<ReferencesPanelModel>()
  #active: ActiveNote | null = null
  #showToken = 0
  #navigator: ReferenceNavigator = NOOP_REFERENCE_NAVIGATOR

  constructor(plugin: Plugin, store: ModuleStore) {
    super(plugin)
    this.#repository = new PassageRepository(new ModulePassageSource(store))
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
    await this.#showFile(workspace.getActiveFile())
  }

  override onSettingsChanged(): void {
    this.#repository.clear()
    this.#models.forEach(
      (model) => void model.setTranslation(this.settings.defaultTranslationId),
    )
  }

  createModel(): ReferencesPanelModel {
    const model = new ReferencesPanelModel(
      { passages: this.#repository },
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

  openReference(reference: Reference): void {
    this.#navigator.openReference(reference, null)
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
}
