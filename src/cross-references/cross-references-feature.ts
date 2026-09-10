import type { Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, PluginFeature } from '../data-access'
import { ObsidianNoteFileVault, type NoteFileVault } from '../notes'
import type { Reference } from '../reference'
import type { CrossReferenceEditing } from './cross-reference-editing'
import {
  crossReferencesFilePath,
  CrossReferenceStore,
  LEGACY_CROSS_REFERENCES_FILE_PATH,
} from './cross-reference-store'
import type { CrossReferenceVault } from './cross-reference-vault'
import { renamedCrossReferencePath } from './cross-reference-file-path'
import { createCrossReferenceNote } from './create-cross-reference-note'
import { ObsidianCrossReferenceVault } from './obsidian-cross-reference-vault'
import { rewriteCrossReferenceNote } from './rewrite-cross-reference-note'

const DEFAULT_FOLLOW_DELAY_MS = 800

// The index a written note is handed to at once, so its row surfaces without
// waiting on the vault's own events (as annotations do); those events then
// find the index already in step.
export type CrossReferenceNoteIndex = {
  indexNote: (path: string, content: string) => void
  renameNote: (path: string, newPath: string) => void
}

export type CrossReferencesFeatureOptions = {
  vault?: CrossReferenceVault
  noteVault?: NoteFileVault
  index?: CrossReferenceNoteIndex
  followDelayMs?: number
}

export class CrossReferencesFeature extends PluginFeature {
  // The data-file store, kept only until #152 migrates its entries into
  // notes: nothing reads it any more.
  readonly store: CrossReferenceStore
  // What the reader's strip works against: every change is a change to the
  // cross-reference's note (ADR 0015), handed to the index at once.
  readonly editing: CrossReferenceEditing
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
    this.editing = {
      create: (members, summary) => this.#createNote(members, summary),
      update: (path, members, summary) => this.#updateNote(path, members, summary),
      delete: (path) => this.#noteVault.trashNote(path),
    }
  }

  // The rewrite touches `refs` and `summary` alone; the note then follows its
  // members to a new name only while it still bears the name generated from
  // the members it held (spec §5a). The index learns of each step before the
  // vault reports it, so a rename event finds nothing stale to carry over.
  async #updateNote(
    path: string,
    members: readonly Reference[],
    summary: string | null,
  ): Promise<void> {
    const content = await this.#noteVault.readNote(path)
    if (content === null) throw new Error(`${path} is not in the vault.`)
    const rewritten = rewriteCrossReferenceNote(content, members, summary)
    await this.#noteVault.modifyNote(path, rewritten.content)
    this.#index?.indexNote(path, rewritten.content)
    const renamed = renamedCrossReferencePath(
      path,
      rewritten.membersBefore,
      rewritten.membersAfter,
      (candidate) => this.#noteVault.exists(candidate),
    )
    if (renamed === null) return
    await this.#noteVault.renameNote(path, renamed)
    this.#index?.renameNote(path, renamed)
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
