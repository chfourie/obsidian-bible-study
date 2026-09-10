import { splitTemplate, withFrontmatterKeys } from '../notes'
import { formatReference, type Reference } from '../reference'

export type ComposedAnnotationNote = {
  content: string
  cursorLine: number
}

const lineCount = (text: string): number => text.split('\n').length - 1

export const composeAnnotationNote = (
  reference: Reference,
  template: string | null,
): ComposedAnnotationNote => {
  const split = splitTemplate(template)
  const frontmatter = withFrontmatterKeys(split.frontmatter, [
    ['ref', [`ref: ${formatReference(reference)}`]],
  ])
  return {
    content: `${frontmatter}${split.body}`,
    cursorLine: lineCount(frontmatter),
  }
}
