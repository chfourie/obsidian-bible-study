import { nextVerse } from './versification'

export type VerseRange = {
  startId: number
  endId: number
}

export type Reference = {
  book: number
  ranges: VerseRange[]
}

export const rangesOverlap = (a: VerseRange, b: VerseRange): boolean =>
  a.startId <= b.endId && b.startId <= a.endId

export const rangeContains = (range: VerseRange, verseId: number): boolean =>
  range.startId <= verseId && verseId <= range.endId

const areAdjacent = (first: VerseRange, second: VerseRange): boolean =>
  nextVerse(first.endId) === second.startId

export const mergeRanges = (ranges: readonly VerseRange[]): VerseRange[] => {
  const sorted = [...ranges].sort(
    (a, b) => a.startId - b.startId || a.endId - b.endId,
  )
  const merged: VerseRange[] = []
  for (const range of sorted) {
    const last = merged[merged.length - 1]
    if (last && (rangesOverlap(last, range) || areAdjacent(last, range))) {
      last.endId = Math.max(last.endId, range.endId)
    } else {
      merged.push({ ...range })
    }
  }
  return merged
}

export const referencesIntersect = (a: Reference, b: Reference): boolean =>
  a.book === b.book &&
  a.ranges.some((rangeA) => b.ranges.some((rangeB) => rangesOverlap(rangeA, rangeB)))

export const enumerateVerseIds = (range: VerseRange): number[] => {
  const verseIds: number[] = []
  let verseId: number | null = range.startId
  while (verseId !== null && verseId <= range.endId) {
    verseIds.push(verseId)
    verseId = nextVerse(verseId)
  }
  return verseIds
}
