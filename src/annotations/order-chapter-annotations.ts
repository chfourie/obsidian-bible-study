import type { AnnotationOrdering } from '../data-access'
import {
  firstIntersectingStart,
  type Reference,
  type VerseRange,
} from '../reference'

export type ChapterAnnotationItem = {
  file: string
  created: number
  // The annotation's declared subject: its frontmatter reference.
  reference: Reference
  // The annotation's references that intersect the scope, placing it when the
  // declared subject itself lies outside.
  intersecting: readonly Reference[]
}

// Annotations read in scripture order: each sits where its declared subject
// first enters the scope — or, when the subject lies entirely outside it,
// where the note's own intersecting references first touch it. Annotations
// opening at the same spot fall back to the annotation-ordering setting, the
// order the per-verse Notes list already uses.
export const orderChapterAnnotations = <T extends ChapterAnnotationItem>(
  items: readonly T[],
  scope: readonly VerseRange[],
  ordering: AnnotationOrdering,
): T[] => {
  const placement = (item: T): number => {
    const declared = firstIntersectingStart(item.reference.ranges, scope)
    if (declared !== Number.POSITIVE_INFINITY) return declared
    return Math.min(
      ...item.intersecting.map((reference) =>
        firstIntersectingStart(reference.ranges, scope),
      ),
    )
  }
  const tiebreak = (a: T, b: T): number =>
    ordering === 'created-oldest-first'
      ? a.created - b.created
      : a.file.localeCompare(b.file)
  return [...items].sort(
    (a, b) => placement(a) - placement(b) || tiebreak(a, b),
  )
}
