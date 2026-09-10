import { uniqueNotePath } from '../notes'
import { referenceLabel, type Reference } from '../reference'

const NAMED_MEMBERS = 2

// The note's name is for recognising it in the quick switcher, nothing more
// (ADR 0015): the first two members' labels, a count for the rest, and the
// colons Obsidian refuses in a filename turned into periods.
export const crossReferenceNoteName = (members: readonly Reference[]): string => {
  const named = members.slice(0, NAMED_MEMBERS).map(referenceLabel).join(' + ')
  const rest = members.length - NAMED_MEMBERS
  const counted = rest > 0 ? `${named} (+${rest})` : named
  return counted.replace(/:/g, '.')
}

export const crossReferenceFilePath = (
  folder: string,
  members: readonly Reference[],
  exists: (path: string) => boolean,
): string => uniqueNotePath(folder, crossReferenceNoteName(members), exists)

const NOTE_EXTENSION = '.md'

const splitNotePath = (path: string): { folder: string; basename: string } => {
  const slash = path.lastIndexOf('/')
  const name = path.slice(slash + 1)
  return {
    folder: slash < 0 ? '' : path.slice(0, slash),
    basename: name.endsWith(NOTE_EXTENSION)
      ? name.slice(0, -NOTE_EXTENSION.length)
      : name,
  }
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// A name the plugin generated, with or without the collision suffix it may
// have added.
const isGeneratedName = (basename: string, members: readonly Reference[]): boolean =>
  new RegExp(`^${escapeRegExp(crossReferenceNoteName(members))}(?: \\d+)?$`).test(basename)

// Where the note moves after a member edit, or null when it stays: a name the
// user chose is theirs to keep (spec §5a), and a name the plugin generated
// follows the members — in the note's own folder, wherever that is.
export const renamedCrossReferencePath = (
  path: string,
  membersBefore: readonly Reference[],
  membersAfter: readonly Reference[],
  exists: (path: string) => boolean,
): string | null => {
  const { folder, basename } = splitNotePath(path)
  if (!isGeneratedName(basename, membersBefore)) return null
  const name = crossReferenceNoteName(membersAfter)
  if (name === basename) return null
  const renamed = uniqueNotePath(folder, name, exists)
  return renamed.startsWith('/') ? renamed.slice(1) : renamed
}
