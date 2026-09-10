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
): string => {
  const base = `${folder}/${crossReferenceNoteName(members)}`
  let candidate = `${base}.md`
  for (let suffix = 1; exists(candidate); suffix++) {
    candidate = `${base} ${suffix}.md`
  }
  return candidate
}
