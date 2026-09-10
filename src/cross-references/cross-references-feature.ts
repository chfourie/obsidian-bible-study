import type { Plugin } from 'obsidian'
import { PluginFeature } from '../data-access'
import { ObsidianNoteFileVault, type NoteFileVault } from '../notes'
import type { Reference } from '../reference'
import type { CrossReferenceEditing } from './cross-reference-editing'
import { renamedCrossReferencePath } from './cross-reference-file-path'
import { createCrossReferenceNote } from './create-cross-reference-note'
import { rewriteCrossReferenceNote } from './rewrite-cross-reference-note'

// The index a written note is handed to at once, so its row surfaces without
// waiting on the vault's own events (as annotations do); those events then
// find the index already in step.
export type CrossReferenceNoteIndex = {
  indexNote: (path: string, content: string) => void
  renameNote: (path: string, newPath: string) => void
  removeNote: (path: string) => void
}

export type CrossReferencesFeatureOptions = {
  noteVault?: NoteFileVault
  index?: CrossReferenceNoteIndex
}

export class CrossReferencesFeature extends PluginFeature {
  // What the reader's strip works against: every change is a change to the
  // cross-reference's note (ADR 0015), handed to the index at once. Reading
  // is the vault index's alone.
  readonly editing: CrossReferenceEditing
  readonly #noteVault: NoteFileVault
  readonly #index: CrossReferenceNoteIndex | null

  constructor(plugin: Plugin, options: CrossReferencesFeatureOptions = {}) {
    super(plugin)
    this.#noteVault = options.noteVault ?? new ObsidianNoteFileVault(plugin)
    this.#index = options.index ?? null
    this.editing = {
      create: (members, summary) => this.#createNote(members, summary),
      update: (path, members, summary) => this.#updateNote(path, members, summary),
      delete: (path) => this.#deleteNote(path),
    }
  }

  async #deleteNote(path: string): Promise<void> {
    await this.#noteVault.trashNote(path)
    this.#index?.removeNote(path)
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
        folder: this.settings.crossReferencesFolder,
        templatePath: this.settings.crossReferenceTemplatePath,
      },
    )
    this.#index?.indexNote(created.path, created.content)
  }
}
