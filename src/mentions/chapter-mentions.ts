import type { ChapterMentionView } from '../contracts'
import {
  firstIntersectingStart,
  formatReference,
  type Reference,
  type VerseRange,
} from '../reference'

export type ChapterMentionSource = {
  file: string
  references: Reference[]
}

const noteTitle = (file: string): string => {
  const basename = file.split('/').pop() ?? file
  return basename.replace(/\.md$/, '')
}

// Mentions read in scripture order: each sits where its first range inside
// the scope starts, with mentions opening at the same spot sorted by path. A
// mention's labels are its in-scope references, in the same order.
export const chapterMentionViews = (
  sources: readonly ChapterMentionSource[],
  scope: readonly VerseRange[],
): ChapterMentionView[] => {
  const intersectingLabels = (references: Reference[]): string[] => {
    const labels = references
      .map((reference) => ({
        reference,
        start: firstIntersectingStart(reference.ranges, scope),
      }))
      .filter(({ start }) => start < Number.POSITIVE_INFINITY)
      .sort((a, b) => a.start - b.start)
      .map(({ reference }) => formatReference(reference))
    return [...new Set(labels)]
  }
  return sources
    .map((source) => ({
      source,
      position: firstIntersectingStart(
        source.references.flatMap((reference) => reference.ranges),
        scope,
      ),
    }))
    .filter(({ position }) => position < Number.POSITIVE_INFINITY)
    .sort(
      (a, b) =>
        a.position - b.position || a.source.file.localeCompare(b.source.file),
    )
    .map(({ source }) => ({
      file: source.file,
      title: noteTitle(source.file),
      labels: intersectingLabels(source.references),
    }))
}
