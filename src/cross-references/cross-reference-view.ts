import { formatReference, referencesIntersect, type Reference } from '../reference'
import type { CrossReference } from './cross-reference-store'

export type CrossReferenceMemberView = {
  label: string
  reference: Reference
}

export type CrossReferenceView = {
  id: string
  description: string | null
  members: CrossReferenceMemberView[]
}

// A surfaced cross-reference lists only the jump-off points: members whose
// verses are already part of the passage being viewed are left out.
export const otherMembersView = (
  entry: CrossReference,
  viewed: Reference[],
): CrossReferenceView => ({
  id: entry.id,
  description: entry.description,
  members: entry.members
    .filter(
      (member) =>
        !viewed.some((reference) => referencesIntersect(member, reference)),
    )
    .map((member) => ({ label: formatReference(member), reference: member })),
})
