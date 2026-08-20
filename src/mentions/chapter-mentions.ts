import type { ChapterMentionView } from '../contracts'
import { formatReference, rangesOverlap, type Reference } from '../reference'

export type ChapterMentionSource = {
  file: string
  references: Reference[]
}

const noteTitle = (file: string): string => {
  const basename = file.split('/').pop() ?? file
  return basename.replace(/\.md$/, '')
}

// Chapter mentions read in scripture order: each sits where its first range
// inside the chapter starts, with mentions opening at the same spot sorted by
// path. A mention's labels are its in-chapter references, in the same order.
export const chapterMentionViews = (
  sources: readonly ChapterMentionSource[],
  chapter: Reference,
): ChapterMentionView[] => {
  const firstIntersectingStart = (reference: Reference): number => {
    const starts = reference.ranges
      .filter((range) =>
        chapter.ranges.some((chapterRange) => rangesOverlap(range, chapterRange)),
      )
      .map((range) => range.startId)
    return starts.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...starts)
  }
  const intersectingLabels = (references: Reference[]): string[] => {
    const labels = references
      .filter((reference) => firstIntersectingStart(reference) < Number.POSITIVE_INFINITY)
      .sort((a, b) => firstIntersectingStart(a) - firstIntersectingStart(b))
      .map(formatReference)
    return [...new Set(labels)]
  }
  const position = (source: ChapterMentionSource): number =>
    Math.min(
      Number.POSITIVE_INFINITY,
      ...source.references.map(firstIntersectingStart),
    )
  return sources
    .filter((source) => position(source) < Number.POSITIVE_INFINITY)
    .sort(
      (a, b) => position(a) - position(b) || a.file.localeCompare(b.file),
    )
    .map((source) => ({
      file: source.file,
      title: noteTitle(source.file),
      labels: intersectingLabels(source.references),
    }))
}
