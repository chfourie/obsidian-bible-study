import { referenceLabel, referencesIntersect, type Reference } from '../reference'
import type { OccurrenceSource } from '../vault-index'

export type CrossReferenceMemberView = {
  label: string
  reference: Reference
  // Position in the note's member list — the handle management actions
  // (remove) use to identify a member the view has filtered out.
  index: number
}

// One cross-reference note as a row surfaces it (spec §5a): the note is the
// handle — its path opens it and, from #151, seeds the strip that edits it.
export type CrossReferenceView = {
  path: string
  summary: string | null
  // Whether anything but whitespace follows the frontmatter: the note icon
  // paints filled when it does, outlined otherwise.
  hasBody: boolean
  members: CrossReferenceMemberView[]
  // The note's complete member list — what editing the entry seeds the strip
  // with, since the filtered view above may have dropped whichever members
  // match the passage being viewed.
  allMembers: Reference[]
}

export type CrossReferenceDeclarationSource = {
  members: readonly Reference[]
  summary: string | null
  hasBody: boolean
}

// The slice of an intersection-query group the cross-reference rows read.
export type CrossReferenceSource = {
  file: string
  crossReference: CrossReferenceDeclarationSource | null
  occurrences: readonly { source: OccurrenceSource }[]
}

// A surfaced cross-reference lists only the jump-off points: members whose
// verses are already part of the passage being viewed are left out.
export const crossReferenceView = (
  path: string,
  declared: CrossReferenceDeclarationSource,
  viewed: readonly Reference[],
): CrossReferenceView => ({
  path,
  summary: declared.summary,
  hasBody: declared.hasBody,
  members: declared.members
    .map((member, index) => ({ member, index }))
    .filter(
      ({ member }) =>
        !viewed.some((reference) => referencesIntersect(member, reference)),
    )
    .map(({ member, index }) => ({
      label: referenceLabel(member),
      reference: member,
      index,
    })),
  allMembers: [...declared.members],
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
  viewed: readonly Reference[],
): CrossReferenceView[] =>
  groups.flatMap((group) =>
    group.crossReference !== null && memberIntersects(group)
      ? [crossReferenceView(group.file, group.crossReference, viewed)]
      : [],
  )
