import type { Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, PluginFeature } from '../data-access'
import { ObsidianNoteFileVault, type NoteFileVault } from '../notes'
import type { Reference } from '../reference'
import type { CrossReferenceEditing } from './cross-reference-catalog'
import {
  crossReferencesFilePath,
  CrossReferenceStore,
  LEGACY_CROSS_REFERENCES_FILE_PATH,
} from './cross-reference-store'
import type { CrossReferenceVault } from './cross-reference-vault'
import { createCrossReferenceNote } from './create-cross-reference-note'
import { ObsidianCrossReferenceVault } from './obsidian-cross-reference-vault'

const DEFAULT_FOLLOW_DELAY_MS = 800

// The index a created note is handed to at once, so its row surfaces without
// waiting on the vault's own change event (as annotations do).
export type CrossReferenceNoteIndex = {
  indexNote: (path: string, content: string) => void
}

export type CrossReferencesFeatureOptions = {
  vault?: CrossReferenceVault
  noteVault?: NoteFileVault
  index?: CrossReferenceNoteIndex
  followDelayMs?: number
}

const NOT_YET_EDITABLE = 'Editing a cross-reference note in place is not supported yet.'

export class CrossReferencesFeature extends PluginFeature {
  // The data-file store, kept only until #152 migrates its entries into
  // notes: nothing reads it any more.
  readonly store: CrossReferenceStore
  // What the reader's strip works against: a new cross-reference is written
  // as a vault note (ADR 0015) and indexed at once; changing or deleting one
  // in place arrives with #151.
  readonly catalog: CrossReferenceEditing
  readonly #vault: CrossReferenceVault
  readonly #noteVault: NoteFileVault
  readonly #index: CrossReferenceNoteIndex | null
  readonly #followDelayMs: number
  #activePath: string | null = null
  #pendingFollow: number | null = null
  #adoptChain: Promise<void> = Promise.resolve()

  constructor(plugin: Plugin, options: CrossReferencesFeatureOptions = {}) {
    super(plugin)
    this.#vault = options.vault ?? new ObsidianCrossReferenceVault(plugin)
    this.#followDelayMs = options.followDelayMs ?? DEFAULT_FOLLOW_DELAY_MS
    this.#noteVault = options.noteVault ?? new ObsidianNoteFileVault(plugin)
    this.#index = options.index ?? null
    this.store = new CrossReferenceStore(this.#vault, {
      filePath: () => this.#configuredPath(),
    })
    this.catalog = {
      create: (members, summary) => this.#createNote(members, summary),
      update: async () => {
        throw new Error(NOT_YET_EDITABLE)
      },
      delete: async () => {
        throw new Error(NOT_YET_EDITABLE)
      },
    }
  }

  async #createNote(
    members: readonly Reference[],
    summary: string | null,
  ): Promise<void> {
    const created = await createCrossReferenceNote(
      this.#noteVault,
      members,
      summary,
      {
        folder: this.#notesFolder(),
        templatePath: this.settings.crossReferenceTemplatePath,
      },
    )
    this.#index?.indexNote(created.path, created.content)
  }

  override async load(): Promise<void> {
    await this.#adoptConfiguredPath()
    const reloadDataFile = (file: { path: string }): void => {
      if (file.path === this.#activePath) void this.store.load()
    }
    this.plugin.registerEvent(this.plugin.app.vault.on('modify', reloadDataFile))
    this.plugin.registerEvent(this.plugin.app.vault.on('create', reloadDataFile))
    this.plugin.registerEvent(this.plugin.app.vault.on('delete', reloadDataFile))
  }

  // The folder setting persists per keystroke, so following it is debounced
  // to keep half-typed folders from being created, and adoptions are chained
  // so an in-flight move never interleaves with the next one.
  override onSettingsChanged(): void {
    if (this.#activePath === null || this.#configuredPath() === this.#activePath) {
      return
    }
    if (this.#pendingFollow !== null) window.clearTimeout(this.#pendingFollow)
    this.#pendingFollow = window.setTimeout(() => {
      this.#pendingFollow = null
      this.#adoptChain = this.#adoptChain.then(() => this.#adoptConfiguredPath())
    }, this.#followDelayMs)
  }

  override unload(): void {
    if (this.#pendingFollow !== null) window.clearTimeout(this.#pendingFollow)
    this.#pendingFollow = null
  }

  // A vault that kept the data file at the root persisted an empty folder;
  // notes never go to the root, so that reads as the default.
  #notesFolder(): string {
    return this.settings.crossReferencesFolder || DEFAULT_SETTINGS.crossReferencesFolder
  }

  #configuredPath(): string {
    return crossReferencesFilePath(this.settings.crossReferencesFolder)
  }

  // Whichever earlier home still holds a file moves to the configured path,
  // unless that path is already taken — then the file found there wins.
  async #adoptConfiguredPath(): Promise<void> {
    const target = this.#configuredPath()
    const previous = this.#activePath
    this.#activePath = target
    const source = await this.#movableSource(target, previous)
    if (source !== null) await this.#vault.rename(source, target)
    await this.store.load()
  }

  async #movableSource(
    target: string,
    previous: string | null,
  ): Promise<string | null> {
    if ((await this.#vault.read(target)) !== null) return null
    for (const candidate of [previous, LEGACY_CROSS_REFERENCES_FILE_PATH]) {
      if (candidate === null || candidate === target) continue
      if ((await this.#vault.read(candidate)) !== null) return candidate
    }
    return null
  }
}
