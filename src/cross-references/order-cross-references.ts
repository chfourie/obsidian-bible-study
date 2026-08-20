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
  const rank = (reference: Reference): [number, number] => [
    chaptersOf(reference).some((key) => viewedChapters.has(key)) ? 0 : 1,
    startOf(reference),
  ]
  const compare = (a: Reference, b: Reference): number => {
    const [leadsA, startA] = rank(a)
    const [leadsB, startB] = rank(b)
    return leadsA - leadsB || startA - startB
  }
  const ordered = entries.map((entry) => ({
    ...entry,
    members: [...entry.members].sort((a, b) => compare(a.reference, b.reference)),
  }))
  const compareEntries = (a: CrossReferenceView, b: CrossReferenceView): number => {
    const depth = Math.max(a.members.length, b.members.length)
    for (let index = 0; index < depth; index += 1) {
      const left = a.members[index]?.reference
      const right = b.members[index]?.reference
      if (left === undefined) return right === undefined ? 0 : -1
      if (right === undefined) return 1
      const order = compare(left, right)
      if (order !== 0) return order
    }
    return 0
  }
  return ordered.sort(compareEntries)
}
