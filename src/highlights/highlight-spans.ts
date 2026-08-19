import type { HighlightCue } from '../reference'

export type HighlightRange = {
  startVerseId: number
  startChar: number
  endVerseId: number
  endChar: number
}

export type HighlightSpan = {
  start: number
  end: number
  slot: number
}

export const rangeWithinVerse = (
  range: HighlightRange,
  verseId: number,
  textLength: number,
): { start: number; end: number } | null => {
  if (verseId < range.startVerseId || verseId > range.endVerseId) return null
  const start = verseId === range.startVerseId ? range.startChar : 0
  const end = verseId === range.endVerseId ? range.endChar : textLength
  const clampedStart = Math.min(start, textLength)
  const clampedEnd = Math.min(end, textLength)
  return clampedEnd > clampedStart
    ? { start: clampedStart, end: clampedEnd }
    : null
}

export const slotRuns = (slots: readonly (number | null)[]): HighlightSpan[] => {
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
export const paintedSlots = (
  cues: readonly HighlightCue[],
  verseId: number,
  textLength: number,
): (number | null)[] => {
  const slots: (number | null)[] = Array.from(
    { length: textLength },
    () => null,
  )
  for (const cue of cues) {
    const span = rangeWithinVerse(cue, verseId, textLength)
    if (span === null) continue
    for (let index = span.start; index < span.end; index++) {
      slots[index] = cue.slot
    }
  }
  return slots
}

export const highlightSpans = (
  cues: readonly HighlightCue[],
  verseId: number,
  textLength: number,
): HighlightSpan[] => slotRuns(paintedSlots(cues, verseId, textLength))
