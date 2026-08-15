import type { Reference } from '../reference'
import { annotationFilePath } from './annotation-file-path'
import type { AnnotationVault } from './annotation-vault'
import { composeAnnotationNote } from './compose-annotation-note'

export type CreateAnnotationOptions = {
  folder: string
  templatePath: string | null
}

export type CreatedAnnotation = {
  path: string
  cursorLine: number
  content: string
}

export const createAnnotation = async (
  vault: AnnotationVault,
  reference: Reference,
  options: CreateAnnotationOptions,
): Promise<CreatedAnnotation> => {
  await vault.ensureFolder(options.folder)
  const path = annotationFilePath(options.folder, reference, (candidate) =>
    vault.exists(candidate),
  )
  const template =
    options.templatePath === null
      ? null
      : await vault.readNote(options.templatePath)
  const { content, cursorLine } = composeAnnotationNote(reference, template)
  await vault.createNote(path, content)
  return { path, cursorLine, content }
}
