import type { FormatSpan } from '../modules'
import type { RedLetterCue } from '../reference'

const DOUBLE_QUOTE_MARKS = /["“”„«»]/g

// Anchors a partial cue's red span to double-quote punctuation in the
// translation's own text: red not touching the verse start begins at the
// first double-quote mark, red not touching the verse end stops after the
// last one. Single quotes are nested quotations and never anchor. Without a
// usable anchor the whole verse goes red — words of Christ are never dropped.
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
  if (marks.length === 0) return wholeVerse
  if (!cue.redAtStart && !cue.redAtEnd && marks.length < 2) return wholeVerse
  return {
    start: cue.redAtStart ? 0 : marks[0],
    end: cue.redAtEnd ? text.length : marks[marks.length - 1] + 1,
  }
}
