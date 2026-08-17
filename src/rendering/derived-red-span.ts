import type { FormatSpan } from '../modules'
import type { RedLetterCue } from '../reference'

const DOUBLE_QUOTE_MARKS = /["“”„«»]/g

// Every double-quote form is ambiguous across conventions (“ closes German
// „…“, « closes German »…«), so marks are classified by attachment instead:
// a mark glued to the word before it closes speech, one detached from it
// opens speech. This also survives French spaced guillemets (« Va. »).
const opensSpeech = (text: string, index: number): boolean =>
  index === 0 || /\s/.test(text[index - 1])

// Anchors a partial cue's red span to double-quote punctuation in the
// translation's own text: red not touching the verse start begins at the
// first opening-shaped mark, red not touching the verse end stops after the
// last closing-shaped one — so a closing quote carried over from the prior
// verse never drags narrative into the red span. Single quotes are nested
// quotations and never anchor. Without a usable anchor the whole verse goes
// red — words of Christ are never dropped.
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
  const openings = marks.filter((index) => opensSpeech(text, index))
  const closings = marks.filter((index) => !opensSpeech(text, index))
  if (!cue.redAtStart && openings.length === 0) return wholeVerse
  if (!cue.redAtEnd && closings.length === 0) return wholeVerse
  const start = cue.redAtStart ? 0 : openings[0]
  const end = cue.redAtEnd ? text.length : closings[closings.length - 1] + 1
  if (start >= end) return wholeVerse
  return { start, end }
}
