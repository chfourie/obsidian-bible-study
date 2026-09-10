import type { Reference } from '../reference'
import { composeCrossReferenceNote } from './compose-cross-reference-note'
import { crossReferenceFilePath } from './cross-reference-file-path'
import type { CrossReferenceNoteVault } from './cross-reference-note-vault'

export type CreateCrossReferenceNoteOptions = {
  folder: string
  templatePath: string | null
}

export type CreatedCrossReferenceNote = {
  path: string
  content: string
}

export const createCrossReferenceNote = async (
  vault: CrossReferenceNoteVault,
  members: readonly Reference[],
  summary: string | null,
  options: CreateCrossReferenceNoteOptions,
): Promise<CreatedCrossReferenceNote> => {
  await vault.ensureFolder(options.folder)
  const path = crossReferenceFilePath(options.folder, members, (candidate) =>
    vault.exists(candidate),
  )
  const template =
    options.templatePath === null
      ? null
      : await vault.readNote(options.templatePath)
  const content = composeCrossReferenceNote(members, summary, template)
  await vault.createNote(path, content)
  return { path, content }
}
