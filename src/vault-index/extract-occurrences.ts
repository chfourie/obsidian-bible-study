import {
  frontmatterLength,
  parseReference,
  scanReferenceMatches,
  type ParseOptions,
} from '../reference'
import type { Occurrence } from './occurrence'

export type ExtractedOccurrence = Omit<Occurrence, 'file'> & {
  translation: string | null
}

const FRONTMATTER_REF_PATTERN = /^ref:[ \t]*(.*?)[ \t]*$/m

const unquote = (value: string): string =>
  value.length >= 2 &&
  (value[0] === '"' || value[0] === "'") &&
  value.endsWith(value[0])
    ? value.slice(1, -1)
    : value

const frontmatterRef = (frontmatter: string): string | null => {
  const match = FRONTMATTER_REF_PATTERN.exec(frontmatter)
  if (!match) return null
  const value = unquote(match[1])
  return value === '' ? null : value
}

const annotationOccurrence = (
  frontmatter: string,
  options: ParseOptions,
): ExtractedOccurrence | null => {
  const ref = frontmatterRef(frontmatter)
  if (ref === null) return null
  const parsed = parseReference(ref, options)
  if (!parsed) return null
  return {
    position: 0,
    reference: parsed.reference,
    source: 'annotation-frontmatter',
    translation: parsed.translation,
  }
}

export const extractOccurrences = (
  content: string,
  options: ParseOptions = {},
): ExtractedOccurrence[] => {
  const occurrences: ExtractedOccurrence[] = []
  const frontmatterEnd = frontmatterLength(content)
  const annotation = annotationOccurrence(
    content.slice(0, frontmatterEnd),
    options,
  )
  if (annotation) occurrences.push(annotation)
  for (const match of scanReferenceMatches(content, options)) {
    occurrences.push({
      position: match.start,
      reference: match.parsed.reference,
      source: 'body',
      translation: match.parsed.translation,
    })
  }
  return occurrences
}
