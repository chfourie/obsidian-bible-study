import {
  frontmatterLength,
  parseReference,
  scanReferenceMatches,
} from '../reference'
import type { Occurrence } from './occurrence'

export type ExtractedOccurrence = Omit<Occurrence, 'file'>

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
): ExtractedOccurrence | null => {
  const ref = frontmatterRef(frontmatter)
  if (ref === null) return null
  const parsed = parseReference(ref)
  if (!parsed) return null
  return {
    position: 0,
    reference: parsed.reference,
    source: 'annotation-frontmatter',
  }
}

export const extractOccurrences = (content: string): ExtractedOccurrence[] => {
  const occurrences: ExtractedOccurrence[] = []
  const frontmatterEnd = frontmatterLength(content)
  const annotation = annotationOccurrence(content.slice(0, frontmatterEnd))
  if (annotation) occurrences.push(annotation)
  for (const match of scanReferenceMatches(content)) {
    occurrences.push({
      position: match.start,
      reference: match.parsed.reference,
      source: 'body',
    })
  }
  return occurrences
}
