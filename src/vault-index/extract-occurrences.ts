import {
  frontmatterLength,
  parseReference,
  scanReferenceMatches,
  type ParseOptions,
  type Reference,
} from '../reference'
import {
  crossReferenceFrontmatter,
  frontmatterScalar,
} from './cross-reference-frontmatter'
import type { Occurrence } from './occurrence'

export type ExtractedOccurrence = Omit<Occurrence, 'file'> & {
  translation: string | null
}

// What a cross-reference note declares (ADR 0015): its parseable members in
// frontmatter order, the summary the Study Panel row prints and whether the
// body holds anything.
export type CrossReferenceDeclaration = {
  members: Reference[]
  summary: string | null
  hasBody: boolean
}

export type ExtractedNote = {
  occurrences: ExtractedOccurrence[]
  crossReference: CrossReferenceDeclaration | null
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
  const ref = frontmatterScalar(frontmatter, 'ref')
  return ref === null
    ? null
    : frontmatterOccurrence(ref, 'annotation-frontmatter', options)
}

const memberOccurrences = (
  members: readonly string[],
  options: ParseOptions,
): ExtractedOccurrence[] =>
  members.flatMap((member) => {
    const occurrence = frontmatterOccurrence(
      member,
      'cross-reference-frontmatter',
      options,
    )
    return occurrence ? [occurrence] : []
  })

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
  const members = memberOccurrences(declared?.members ?? [], options)
  occurrences.push(...members)
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
        : {
            members: members.map((member) => member.reference),
            summary: declared.summary,
            hasBody: hasBody(content, frontmatterEnd),
          },
  }
}

export const extractOccurrences = (
  content: string,
  options: ParseOptions = {},
): ExtractedOccurrence[] => extractNote(content, options).occurrences
