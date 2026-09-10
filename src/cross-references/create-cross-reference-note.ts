import type { NoteFileVault } from '../notes'
import type { Reference } from '../reference'
import { composeCrossReferenceNote } from './compose-cross-reference-note'
import { crossReferenceFilePath } from './cross-reference-file-path'

export type CreateCrossReferenceNoteOptions = {
  folder: string
  templatePath: string | null
}

export const createCrossReferenceNote = async (
  vault: NoteFileVault,
  members: readonly Reference[],
  summary: string | null,
  options: CreateCrossReferenceNoteOptions,
): Promise<void> => {
  await vault.ensureFolder(options.folder)
  const path = crossReferenceFilePath(options.folder, members, (candidate) =>
    vault.exists(candidate),
  )
  const template =
    options.templatePath === null
      ? null
      : await vault.readNote(options.templatePath)
  await vault.createNote(path, composeCrossReferenceNote(members, summary, template))
}
