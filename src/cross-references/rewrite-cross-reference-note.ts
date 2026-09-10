import { withFrontmatterKeys } from '../notes'
import { frontmatterLength, type Reference } from '../reference'
import { membersAsWritten, type MemberAsWritten } from '../vault-index'
import { crossReferenceMemberKeys } from './compose-cross-reference-note'

export type RewrittenCrossReferenceNote = {
  content: string
  membersBefore: MemberAsWritten[]
  membersAfter: MemberAsWritten[]
}

const isVerbatim = (member: MemberAsWritten): member is string =>
  typeof member === 'string'

// A member the plugin could not read stays at its index in the list, or
// trails it once the list is shorter than that; several keep their order.
const withVerbatimMembers = (
  written: readonly MemberAsWritten[],
  members: readonly Reference[],
): MemberAsWritten[] => {
  const merged: MemberAsWritten[] = [...members]
  written.forEach((member, position) => {
    if (isVerbatim(member)) merged.splice(Math.min(position, merged.length), 0, member)
  })
  return merged
}

// Rewrites the note's `refs` block and `summary` key; every other key, their
// order and the body come through byte for byte.
export const rewriteCrossReferenceNote = (
  content: string,
  members: readonly Reference[],
  summary: string | null,
): RewrittenCrossReferenceNote => {
  const end = frontmatterLength(content)
  const frontmatter = content.slice(0, end)
  const membersBefore = membersAsWritten(content)
  const membersAfter = withVerbatimMembers(membersBefore, members)
  const keys = crossReferenceMemberKeys(membersAfter, summary)
  return {
    content: `${withFrontmatterKeys(frontmatter, keys)}${content.slice(end)}`,
    membersBefore,
    membersAfter,
  }
}
