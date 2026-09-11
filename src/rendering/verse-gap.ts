import { nextVerse, rangeContains, type Reference } from '../reference'

// The character a Verse Gap stands as wherever a passage renders as text. A
// real U+2026 rather than CSS chrome, so copying the passage copies it
// (spec §Verse Gap).
export const PASSAGE_ELLIPSIS = '…'

// The verses the Canonical Grid holds between two rendered ones, or null when
// the second does not lie ahead of the first on the grid at all.
const skippedVerseIds = (
  previousVerseId: number,
  verseId: number,
): number[] | null => {
  const skipped: number[] = []
  let candidate = nextVerse(previousVerseId)
  while (candidate !== null && candidate < verseId) {
    skipped.push(candidate)
    candidate = nextVerse(candidate)
  }
  return candidate === verseId ? skipped : null
}

// A Verse Gap is the author's own skip (CONTEXT.md — Verse Gap): grid verses
// between two rendered ones that the reference never asked for. Verses the
// reference does ask for but the translation does not serve are a content gap
// instead, and a chapter boundary is adjacency — neither shows an ellipsis, so
// an ellipsis always means the author left something out.
export const isVerseGap = (
  previousVerseId: number,
  verseId: number,
  reference: Reference,
): boolean => {
  const skipped = skippedVerseIds(previousVerseId, verseId)
  return (
    skipped !== null &&
    skipped.some(
      (skippedId) =>
        !reference.ranges.some((range) => rangeContains(range, skippedId)),
    )
  )
}
