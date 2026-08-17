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
// anchors the list. An entry ranks by its own leading member.
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
  const lead = (entry: CrossReferenceView): Reference =>
    entry.members[0]?.reference ?? { book: 0, ranges: [] }
  return ordered.sort((a, b) => compare(lead(a), lead(b)))
}
