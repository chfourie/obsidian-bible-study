import { frontmatterLength, type ParseOptions, type Reference } from '../reference'
import { crossReferenceFrontmatter, parseCrossReferenceMembers } from '../vault-index'

// A `refs` item as the note holds it: the Reference it parses to, or its
// text when the plugin cannot read it — kept verbatim through every rewrite
// (spec §5a).
export type MemberAsWritten = Reference | string

export const isParsedMember = (member: MemberAsWritten): member is Reference =>
  typeof member !== 'string'

export const membersAsWritten = (
  content: string,
  options: ParseOptions = {},
): MemberAsWritten[] => {
  const frontmatter = content.slice(0, frontmatterLength(content))
  const declared = crossReferenceFrontmatter(frontmatter)
  return parseCrossReferenceMembers(declared?.members ?? [], options).map(
    ({ text, parsed }) => parsed?.reference ?? text,
  )
}
