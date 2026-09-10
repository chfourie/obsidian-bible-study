import { splitNotePath, uniqueNotePath } from '../notes'
import { referenceLabel, type Reference } from '../reference'
import type { MemberAsWritten } from '../vault-index'

const NAMED_MEMBERS = 2

const noteName = (named: readonly Reference[], memberCount: number): string => {
  const joined = named.map(referenceLabel).join(' + ')
  const rest = memberCount - NAMED_MEMBERS
  const counted = rest > 0 ? `${joined} (+${rest})` : joined
  return counted.replace(/:/g, '.')
}

// The note's name is for recognising it in the quick switcher, nothing more
// (ADR 0015): the first two members' labels, a count for the rest, and the
// colons Obsidian refuses in a filename turned into periods.
export const crossReferenceNoteName = (members: readonly Reference[]): string =>
  noteName(members.slice(0, NAMED_MEMBERS), members.length)

const isParsed = (member: MemberAsWritten): member is Reference =>
  typeof member !== 'string'

// The name the plugin would generate for the members as the note holds
// them, or null when a named member is one it cannot read.
const generatedName = (members: readonly MemberAsWritten[]): string | null => {
  const named = members.slice(0, NAMED_MEMBERS)
  return named.every(isParsed) ? noteName(named, members.length) : null
}

export const crossReferenceFilePath = (
  folder: string,
  members: readonly Reference[],
  exists: (path: string) => boolean,
): string => uniqueNotePath(folder, crossReferenceNoteName(members), exists)

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Generated with or without the collision suffix the plugin may have added.
const isGeneratedName = (basename: string, name: string): boolean =>
  new RegExp(`^${escapeRegExp(name)}(?: \\d+)?$`).test(basename)

// Where the note moves after a member edit, or null when it stays: a name the
// user chose is theirs to keep (spec §5a), and a name the plugin generated
// follows the members — in the note's own folder, wherever that is.
export const renamedCrossReferencePath = (
  path: string,
  membersBefore: readonly MemberAsWritten[],
  membersAfter: readonly MemberAsWritten[],
  exists: (path: string) => boolean,
): string | null => {
  const { folder, basename } = splitNotePath(path)
  const before = generatedName(membersBefore)
  const after = generatedName(membersAfter)
  if (before === null || after === null || !isGeneratedName(basename, before)) return null
  if (after === basename) return null
  return uniqueNotePath(folder, after, exists)
}
