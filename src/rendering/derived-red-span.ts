import type { FormatSpan } from '../modules'
import type { RedLetterCue } from '../reference'

const DOUBLE_QUOTE_MARKS = /["“”„«»]/g

// Anchors a partial cue's red span to double-quote punctuation in the
// translation's own text: red runs from the first double-quote mark through
// the last, marks included. The cue's redAtStart/redAtEnd flags encode BSB's
// clause order, which other translations reorder, so with two or more marks
// they are ignored. A lone mark whose cue has exactly one red edge is the
// red/plain boundary — speech spilling past the verse edge prints only its
// opening or closing mark — and the flags say which side is red. Single
// quotes are nested quotations and never anchor. Otherwise the whole verse
// goes red — words of Christ are never dropped (KJV prints no quotes at
// all). Narration between two quoted speeches stays red at this granularity.
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
  if (marks.length >= 2) {
    return { start: marks[0], end: marks[marks.length - 1] + 1 }
  }
  if (marks.length === 1 && cue.redAtStart !== cue.redAtEnd) {
    return cue.redAtEnd
      ? { start: marks[0], end: text.length }
      : { start: 0, end: marks[0] + 1 }
  }
  return wholeVerse
}
