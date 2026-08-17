import { formatReference, referencesIntersect, type Reference } from '../reference'
import type { CrossReference } from './cross-reference-store'

export type CrossReferenceMemberView = {
  label: string
  reference: Reference
  // Position in the underlying entry's member list — the handle management
  // actions (remove) use to identify a member the view has filtered out.
  index: number
}

export type CrossReferenceView = {
  id: string
  description: string | null
  members: CrossReferenceMemberView[]
  // The entry's complete, unfiltered member list — what editing the entry
  // seeds the strip with, since the filtered view above has already dropped
  // whichever members match the passage being viewed.
  allMembers: Reference[]
}

// A surfaced cross-reference lists only the jump-off points: members whose
// verses are already part of the passage being viewed are left out.
export const crossReferenceView = (
  entry: CrossReference,
  viewed: Reference[],
): CrossReferenceView => ({
  id: entry.id,
  description: entry.description,
  members: entry.members
    .map((member, index) => ({ member, index }))
    .filter(
      ({ member }) =>
        !viewed.some((reference) => referencesIntersect(member, reference)),
    )
    .map(({ member, index }) => ({
      label: formatReference(member),
      reference: member,
      index,
    })),
  allMembers: entry.members,
})
