import type { AnnotationOrdering } from '../data-access'
import { rangesOverlap, type Reference } from '../reference'

export type ChapterAnnotationItem = {
  file: string
  created: number
  reference: Reference
}

// Chapter annotations read in scripture order: each sits where its first
// range inside the chapter starts. Annotations opening at the same spot fall
// back to the annotation-ordering setting, the order the per-verse Notes list
// already uses.
export const orderChapterAnnotations = <T extends ChapterAnnotationItem>(
  items: readonly T[],
  chapter: Reference,
  ordering: AnnotationOrdering,
): T[] => {
  const firstIntersectingStart = (reference: Reference): number => {
    const starts = reference.ranges
      .filter((range) =>
        chapter.ranges.some((chapterRange) => rangesOverlap(range, chapterRange)),
      )
      .map((range) => range.startId)
    return starts.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...starts)
  }
  const tiebreak = (a: T, b: T): number =>
    ordering === 'created-oldest-first'
      ? a.created - b.created
      : a.file.localeCompare(b.file)
  return [...items].sort(
    (a, b) =>
      firstIntersectingStart(a.reference) - firstIntersectingStart(b.reference) ||
      tiebreak(a, b),
  )
}
