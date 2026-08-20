import type { Reference } from '../reference'
import type { CrossReferenceView } from './cross-reference-view'

// A verse id encodes book, chapter and verse in one ascending number, so its
// leading digits identify a chapter outright and comparing ids sorts by book
// then chapter then verse.
const chapterKey = (verseId: number): number => Math.floor(verseId / 1_000)

const chaptersOf = (reference: Reference): number[] =>
  reference.ranges.flatMap((range) => {
    const keys: number[] = []
    for (let key = chapterKey(range.startId); key <= chapterKey(range.endId); key += 1)
      keys.push(key)
    return keys
  })

const startOf = (reference: Reference): number =>
  reference.ranges.length === 0
    ? Number.POSITIVE_INFINITY
    : Math.min(...reference.ranges.map((range) => range.startId))

// Cross-references and their members read in Bible order, except that anything
// sharing a chapter with the passage in hand leads — what is already on screen
// anchors the list. Entries rank by their members in turn, so entries led by
// the same passage are told apart by where else they point.
export const orderCrossReferences = (
  entries: readonly CrossReferenceView[],
  context: readonly Reference[],
): CrossReferenceView[] => {
  const viewedChapters = new Set(context.flatMap(chaptersOf))
  // A member's rank — leads iff it shares a chapter with the context, then
  // its first verse — computed once per member, not per comparison.
  const rank = (reference: Reference): [number, number] => [
    chaptersOf(reference).some((key) => viewedChapters.has(key)) ? 0 : 1,
    startOf(reference),
  ]
  const compareRanks = (a: [number, number], b: [number, number]): number =>
    a[0] - b[0] || a[1] - b[1]
  const ordered = entries.map((entry) => {
    const members = entry.members
      .map((member) => ({ member, rank: rank(member.reference) }))
      .sort((a, b) => compareRanks(a.rank, b.rank))
    return {
      entry: { ...entry, members: members.map(({ member }) => member) },
      ranks: members.map((member) => member.rank),
    }
  })
  type Ranked = (typeof ordered)[number]
  const compareEntries = (a: Ranked, b: Ranked): number => {
    const depth = Math.min(a.ranks.length, b.ranks.length)
    for (let index = 0; index < depth; index += 1) {
      const order = compareRanks(a.ranks[index], b.ranks[index])
      if (order !== 0) return order
    }
    return a.ranks.length - b.ranks.length
  }
  return ordered.sort(compareEntries).map(({ entry }) => entry)
}
