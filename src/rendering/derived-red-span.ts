import type { FormatSpan } from '../modules'
import type { RedLetterCue } from '../reference'

const DOUBLE_QUOTE_MARKS = /["“”„«»]/g

// Anchors a partial cue's red span to double-quote punctuation in the
// translation's own text: red runs from the first double-quote mark through
// the last, marks included. The cue's redAtStart/redAtEnd flags encode BSB's
// clause order, which other translations reorder, so they are ignored here.
// Single quotes are nested quotations and never anchor. Without two marks the
// whole verse goes red — words of Christ are never dropped (KJV prints no
// quotes at all). Narration between two quoted speeches stays red at this
// granularity.
export const derivedRedSpan = (
  text: string,
  cue: RedLetterCue,
): FormatSpan | null => {
  if (cue.kind === 'none') return null
  const wholeVerse = { start: 0, end: text.length }
  if (cue.kind === 'full') return wholeVerse
  const marks = [...text.matchAll(DOUBLE_QUOTE_MARKS)].map(
    (match) => match.index,
  )
  if (marks.length < 2) return wholeVerse
  return { start: marks[0], end: marks[marks.length - 1] + 1 }
}
