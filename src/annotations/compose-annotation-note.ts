import {
  formatReference,
  frontmatterLength,
  type Reference,
} from '../reference'

export type ComposedAnnotationNote = {
  content: string
  cursorLine: number
}

const REF_LINE_PATTERN = /^ref:/

const withRefInFrontmatter = (frontmatter: string, refLine: string): string => {
  const lines = frontmatter.replace(/\n$/, '').split('\n')
  const refIndex = lines.findIndex((line) => REF_LINE_PATTERN.test(line))
  if (refIndex >= 0) lines[refIndex] = refLine
  else lines.splice(lines.length - 1, 0, refLine)
  return `${lines.join('\n')}\n`
}

const lineCount = (text: string): number => text.split('\n').length - 1

export const composeAnnotationNote = (
  reference: Reference,
  template: string | null,
): ComposedAnnotationNote => {
  const refLine = `ref: ${formatReference(reference)}`
  const templateFrontmatterEnd =
    template === null ? 0 : frontmatterLength(template)
  const body = template === null ? '\n' : template.slice(templateFrontmatterEnd)
  const frontmatter =
    template !== null && templateFrontmatterEnd > 0
      ? withRefInFrontmatter(template.slice(0, templateFrontmatterEnd), refLine)
      : `---\n${refLine}\n---\n`
  return {
    content: `${frontmatter}${body}`,
    cursorLine: lineCount(frontmatter),
  }
}
