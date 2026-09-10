import { referenceLabel, type Reference } from '../reference'
import type { CrossReferenceDeclaration, OccurrenceSource } from '../vault-index'

export type CrossReferenceMemberView = {
  label: string
  reference: Reference
}

// One cross-reference note as a row surfaces it (spec §5a): every member,
// the summary and the body flag. The note is the handle — its path opens it
// and seeds the strip that edits it.
export type CrossReferenceView = {
  path: string
  summary: string | null
  // Whether anything but whitespace follows the frontmatter: the note icon
  // paints filled when it does, outlined otherwise.
  hasBody: boolean
  members: CrossReferenceMemberView[]
}

// The slice of an intersection-query group the cross-reference rows read.
export type CrossReferenceSource = {
  file: string
  crossReference: CrossReferenceDeclaration | null
  occurrences: readonly { source: OccurrenceSource }[]
}

const crossReferenceView = (
  path: string,
  declared: CrossReferenceDeclaration,
): CrossReferenceView => ({
  path,
  summary: declared.summary,
  hasBody: declared.hasBody,
  members: declared.members.map((member) => ({
    label: referenceLabel(member),
    reference: member,
  })),
})

// A group earns a row when one of the note's members intersects the query;
// a cross-reference note whose body alone touches the passage stays off the
// list — and off the mentions too (spec §5a).
const memberIntersects = (group: CrossReferenceSource): boolean =>
  group.occurrences.some(
    (occurrence) => occurrence.source === 'cross-reference-frontmatter',
  )

export const crossReferenceViews = (
  groups: readonly CrossReferenceSource[],
): CrossReferenceView[] =>
  groups.flatMap((group) =>
    group.crossReference !== null && memberIntersects(group)
      ? [crossReferenceView(group.file, group.crossReference)]
      : [],
  )
