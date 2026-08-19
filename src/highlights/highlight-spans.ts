import type { HighlightCue } from '../reference'

export type HighlightSpan = {
  start: number
  end: number
  slot: number
}

const cueSpanInVerse = (
  cue: HighlightCue,
  verseId: number,
  textLength: number,
): HighlightSpan | null => {
  if (verseId < cue.startVerseId || verseId > cue.endVerseId) return null
  const start = verseId === cue.startVerseId ? cue.startChar : 0
  const end = verseId === cue.endVerseId ? cue.endChar : textLength
  const clampedStart = Math.min(start, textLength)
  const clampedEnd = Math.min(end, textLength)
  return clampedEnd > clampedStart
    ? { start: clampedStart, end: clampedEnd, slot: cue.slot }
    : null
}

const runsOf = (slots: (number | null)[]): HighlightSpan[] => {
  const spans: HighlightSpan[] = []
  slots.forEach((slot, index) => {
    if (slot === null) return
    const open = spans[spans.length - 1]
    if (open !== undefined && open.end === index && open.slot === slot) {
      open.end = index + 1
      return
    }
    spans.push({ start: index, end: index + 1, slot })
  })
  return spans
}

// Later cues paint over earlier ones: a stroke always claims the whole
// selection it covers, the way a physical highlighter pass does.
export const highlightSpans = (
  cues: readonly HighlightCue[],
  verseId: number,
  textLength: number,
): HighlightSpan[] => {
  const slots: (number | null)[] = Array.from(
    { length: textLength },
    () => null,
  )
  for (const cue of cues) {
    const span = cueSpanInVerse(cue, verseId, textLength)
    if (span === null) continue
    for (let index = span.start; index < span.end; index++) {
      slots[index] = span.slot
    }
  }
  return runsOf(slots)
}
