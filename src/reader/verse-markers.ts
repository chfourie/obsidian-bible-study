import { rangesOverlap, type Reference } from '../reference'

export type VerseMarkerSource = {
  file: string
  annotation: boolean
  references: Reference[]
}

export type VerseMarkerCounts = { annotations: number; mentions: number }

// Where each intersecting note earns a mark: every verse range of every one
// of its references marks the first verse of that range visible in the
// chapter — a range entering from an earlier chapter marks the chapter's
// first covered verse. Counts at a verse are per note, not per occurrence.
export const verseMarkers = (
  sources: readonly VerseMarkerSource[],
  chapter: Reference,
): Map<number, VerseMarkerCounts> => {
  const marks = new Map<
    number,
    { annotations: Set<string>; mentions: Set<string> }
  >()
  for (const { file, annotation, references } of sources) {
    for (const reference of references) {
      for (const range of reference.ranges) {
        const starts = chapter.ranges
          .filter((chapterRange) => rangesOverlap(range, chapterRange))
          .map((chapterRange) => Math.max(range.startId, chapterRange.startId))
        if (starts.length === 0) continue
        const verseId = Math.min(...starts)
        const at = marks.get(verseId) ?? {
          annotations: new Set<string>(),
          mentions: new Set<string>(),
        }
        at[annotation ? 'annotations' : 'mentions'].add(file)
        marks.set(verseId, at)
      }
    }
  }
  return new Map(
    [...marks].map(([verseId, { annotations, mentions }]) => [
      verseId,
      { annotations: annotations.size, mentions: mentions.size },
    ]),
  )
}
