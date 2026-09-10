import { splitTemplate, withFrontmatterKeys } from '../notes'
import {
  formatReference,
  frontmatterLineCount,
  type Reference,
} from '../reference'

export type ComposedAnnotationNote = {
  content: string
  cursorLine: number
}

export const composeAnnotationNote = (
  reference: Reference,
  template: string | null,
): ComposedAnnotationNote => {
  const split = splitTemplate(template)
  const frontmatter = withFrontmatterKeys(split.frontmatter, [
    ['ref', [`ref: ${formatReference(reference)}`]],
  ])
  const content = `${frontmatter}${split.body}`
  return { content, cursorLine: frontmatterLineCount(content) }
}
