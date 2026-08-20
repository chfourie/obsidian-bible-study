import type { Vault } from 'obsidian'
import { frontmatterLength } from '../reference'

export type AnnotationDetails = {
  body: string
  created: number
}

// The annotation note's renderable body — its content with the frontmatter
// stripped — and its creation time; null when the note no longer loads.
export const readAnnotationDetails = async (
  vault: Vault,
  file: string,
): Promise<AnnotationDetails | null> => {
  const noteFile = vault.getFileByPath(file)
  if (noteFile === null) return null
  const content = await vault.cachedRead(noteFile)
  return {
    body: content.slice(frontmatterLength(content)),
    created: noteFile.stat.ctime,
  }
}
