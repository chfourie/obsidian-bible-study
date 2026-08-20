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
  const start = (reference: Reference): number =>
    firstIntersectingStart(reference.ranges, scope)
  const intersectingLabels = (references: Reference[]): string[] => {
    const labels = references
      .filter((reference) => start(reference) < Number.POSITIVE_INFINITY)
      .sort((a, b) => start(a) - start(b))
      .map(formatReference)
    return [...new Set(labels)]
  }
  const position = (source: ChapterMentionSource): number =>
    Math.min(Number.POSITIVE_INFINITY, ...source.references.map(start))
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
