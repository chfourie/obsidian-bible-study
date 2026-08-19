import { nextVerse, type HighlightCue } from '../reference'
import {
  paintedSlots,
  rangeWithinVerse,
  slotRuns,
  type HighlightRange,
} from './highlight-spans'

export type PassageVerse = {
  verseId: number
  text: string
}

// A null slot erases: the eraser is a stroke like any other.
export type HighlightStroke = HighlightRange & {
  slot: number | null
}

const strokeSlots = (
  cues: readonly HighlightCue[],
  stroke: HighlightStroke | null,
  verse: PassageVerse,
): (number | null)[] => {
  const slots = paintedSlots(cues, verse.verseId, verse.text.length)
  const span =
    stroke && rangeWithinVerse(stroke, verse.verseId, verse.text.length)
  if (!span) return slots
  for (let index = span.start; index < span.end; index++) {
    slots[index] = stroke.slot
  }
  return slots
}

const cuesFrom = (
  verses: readonly PassageVerse[],
  slotsByVerse: readonly (number | null)[][],
): HighlightCue[] => {
  const cues: HighlightCue[] = []
  let previous: PassageVerse | null = null
  verses.forEach((verse, index) => {
    for (const run of slotRuns(slotsByVerse[index])) {
      const open = cues[cues.length - 1]
      const continuesAcrossVerses =
        open !== undefined &&
        previous !== null &&
        open.slot === run.slot &&
        run.start === 0 &&
        open.endVerseId === previous.verseId &&
        open.endChar === previous.text.length &&
        nextVerse(previous.verseId) === verse.verseId
      if (continuesAcrossVerses) {
        open.endVerseId = verse.verseId
        open.endChar = run.end
      } else {
        cues.push({
          slot: run.slot,
          startVerseId: verse.verseId,
          startChar: run.start,
          endVerseId: verse.verseId,
          endChar: run.end,
        })
      }
    }
    previous = verse
  })
  return cues
}

const restroke = (
  cues: readonly HighlightCue[],
  stroke: HighlightStroke | null,
  verses: readonly PassageVerse[],
): HighlightCue[] =>
  cuesFrom(
    verses,
    verses.map((verse) => strokeSlots(cues, stroke, verse)),
  )

export const applyHighlightStroke = (
  cues: readonly HighlightCue[],
  stroke: HighlightStroke,
  verses: readonly PassageVerse[],
): HighlightCue[] => restroke(cues, stroke, verses)

export const canonicalHighlightCues = (
  cues: readonly HighlightCue[],
  verses: readonly PassageVerse[],
): HighlightCue[] => restroke(cues, null, verses)
