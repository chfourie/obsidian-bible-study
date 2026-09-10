import {
  frontmatterLength,
  parseReference,
  scanReferenceMatches,
  type ParseOptions,
} from '../reference'
import { crossReferenceFrontmatter } from './cross-reference-frontmatter'
import type { Occurrence } from './occurrence'

export type ExtractedOccurrence = Omit<Occurrence, 'file'> & {
  translation: string | null
}

// What the index keeps of a cross-reference note beyond its occurrences: the
// summary the Study Panel row prints and whether the body holds anything.
export type CrossReferenceNote = {
  summary: string | null
  hasBody: boolean
}

export type ExtractedNote = {
  occurrences: ExtractedOccurrence[]
  crossReference: CrossReferenceNote | null
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

const frontmatterOccurrence = (
  text: string,
  source: ExtractedOccurrence['source'],
  options: ParseOptions,
): ExtractedOccurrence | null => {
  const parsed = parseReference(text, options)
  if (!parsed) return null
  return {
    position: 0,
    reference: parsed.reference,
    source,
    translation: parsed.translation,
  }
}

const annotationOccurrence = (
  frontmatter: string,
  options: ParseOptions,
): ExtractedOccurrence | null => {
  const ref = frontmatterRef(frontmatter)
  return ref === null
    ? null
    : frontmatterOccurrence(ref, 'annotation-frontmatter', options)
}

const hasBody = (content: string, frontmatterEnd: number): boolean =>
  content.slice(frontmatterEnd).trim() !== ''

export const extractNote = (
  content: string,
  options: ParseOptions = {},
): ExtractedNote => {
  const occurrences: ExtractedOccurrence[] = []
  const frontmatterEnd = frontmatterLength(content)
  const frontmatter = content.slice(0, frontmatterEnd)
  const annotation = annotationOccurrence(frontmatter, options)
  if (annotation) occurrences.push(annotation)
  const declared = crossReferenceFrontmatter(frontmatter)
  for (const member of declared?.members ?? []) {
    const occurrence = frontmatterOccurrence(
      member,
      'cross-reference-frontmatter',
      options,
    )
    if (occurrence) occurrences.push(occurrence)
  }
  for (const match of scanReferenceMatches(content, options)) {
    occurrences.push({
      position: match.start,
      reference: match.parsed.reference,
      source: 'body',
      translation: match.parsed.translation,
    })
  }
  return {
    occurrences,
    crossReference:
      declared === null
        ? null
        : { summary: declared.summary, hasBody: hasBody(content, frontmatterEnd) },
  }
}

export const extractOccurrences = (
  content: string,
  options: ParseOptions = {},
): ExtractedOccurrence[] => extractNote(content, options).occurrences
