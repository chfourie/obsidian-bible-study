import { withFrontmatterKeys } from '../notes'
import { frontmatterLength, parseReference, type Reference } from '../reference'
import { crossReferenceFrontmatter } from '../vault-index'
import {
  crossReferenceMemberKeys,
  type WrittenMember,
} from './compose-cross-reference-note'

const isUnparseable = (member: string): boolean =>
  parseReference(member, { translationIds: [] }) === null

// A member the plugin could not read stays where the user put it, so a typo
// or a Book not installed here is never lost to a rewrite (spec §5a).
const withVerbatimMembers = (
  written: readonly string[],
  members: readonly Reference[],
): WrittenMember[] => {
  const merged: WrittenMember[] = [...members]
  written.forEach((member, position) => {
    if (isUnparseable(member)) merged.splice(Math.min(position, merged.length), 0, member)
  })
  return merged
}

// Rewrites the note's `refs` block and `summary` key; every other key, their
// order and the body come through byte for byte.
export const rewriteCrossReferenceNote = (
  content: string,
  members: readonly Reference[],
  summary: string | null,
): string => {
  const end = frontmatterLength(content)
  const frontmatter = content.slice(0, end)
  const written = crossReferenceFrontmatter(frontmatter)?.members ?? []
  const keys = crossReferenceMemberKeys(
    withVerbatimMembers(written, members),
    summary,
  )
  return `${withFrontmatterKeys(frontmatter, keys)}${content.slice(end)}`
}
