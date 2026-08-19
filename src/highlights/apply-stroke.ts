import {
  nextVerse,
  type HighlightCue,
  type HighlightSlot,
} from '../reference'
import {
  paintedSlots,
  rangeWithinVerse,
  slotRuns,
  type HighlightRange,
} from './highlight-spans'

export type VerseText = {
  verseId: number
  text: string
}

// A null slot erases: the eraser is a stroke like any other.
export type HighlightStroke = HighlightRange & {
  slot: HighlightSlot | null
}

// A place in the passage: the character boundary before `char` of `verseId`.
type Position = {
  verseId: number
  char: number
}

type Portion = {
  slot: HighlightSlot
  start: Position
  end: Position
}

type Region = {
  start: Position
  end: Position
}

const before = (a: Position, b: Position): boolean =>
  a.verseId === b.verseId ? a.char < b.char : a.verseId < b.verseId

const samePlace = (a: Position, b: Position): boolean =>
  a.verseId === b.verseId && a.char === b.char

const later = (a: Position, b: Position): Position => (before(a, b) ? b : a)

const portionOf = (cue: HighlightCue): Portion => ({
  slot: cue.slot,
  start: { verseId: cue.startVerseId, char: cue.startChar },
  end: { verseId: cue.endVerseId, char: cue.endChar },
})

const cueOf = (portion: Portion): HighlightCue => ({
  slot: portion.slot,
  startVerseId: portion.start.verseId,
  startChar: portion.start.char,
  endVerseId: portion.end.verseId,
  endChar: portion.end.char,
})

const servedVerse = (
  verses: readonly VerseText[],
  verseId: number | null,
): VerseText | undefined =>
  verses.find((verse) => verse.verseId === verseId)

const runsOn = (
  verses: readonly VerseText[],
  spanOf: (verse: VerseText) => { start: number; end: number } | null,
): Region[] => {
  const regions: Region[] = []
  let previous: VerseText | null = null
  for (const verse of verses) {
    const span = spanOf(verse)
    if (span !== null) {
      const open = regions[regions.length - 1]
      const continuesAcrossVerses =
        open !== undefined &&
        previous !== null &&
        span.start === 0 &&
        open.end.verseId === previous.verseId &&
        open.end.char === previous.text.length &&
        nextVerse(previous.verseId) === verse.verseId
      if (continuesAcrossVerses) {
        open.end = { verseId: verse.verseId, char: span.end }
      } else {
        regions.push({
          start: { verseId: verse.verseId, char: span.start },
          end: { verseId: verse.verseId, char: span.end },
        })
      }
    }
    previous = verse
  }
  return regions
}

// Where a range actually lands in the text this translation serves. Verses the
// module leaves out are not part of any region, so nothing the stroke does can
// reach the cues written over them.
const servedRegions = (
  range: HighlightRange,
  verses: readonly VerseText[],
): Region[] =>
  runsOn(verses, (verse) =>
    rangeWithinVerse(range, verse.verseId, verse.text.length),
  )

const outsideRegion = (portion: Portion, region: Region): Portion[] => {
  if (!before(region.start, portion.end) || !before(portion.start, region.end))
    return [portion]
  const kept: Portion[] = []
  if (before(portion.start, region.start))
    kept.push({ ...portion, end: region.start })
  if (before(region.end, portion.end))
    kept.push({ ...portion, start: region.end })
  return kept
}

const outsideRegions = (
  portions: readonly Portion[],
  regions: readonly Region[],
): Portion[] =>
  regions.reduce<Portion[]>(
    (kept, region) =>
      kept.flatMap((portion) => outsideRegion(portion, region)),
    [...portions],
  )

// The same coverage can be spelled several ways where verses meet — the end of
// one verse and the start of the next name the same place. Boundaries are
// pulled onto the text they cover so equal cues read equal.
const tightenedStart = (
  start: Position,
  verses: readonly VerseText[],
): Position => {
  let place = start
  for (;;) {
    const verse = servedVerse(verses, place.verseId)
    if (verse === undefined || place.char !== verse.text.length) return place
    const next = servedVerse(verses, nextVerse(place.verseId))
    if (next === undefined) return place
    place = { verseId: next.verseId, char: 0 }
  }
}

const tightenedEnd = (
  end: Position,
  verses: readonly VerseText[],
): Position => {
  let place = end
  for (;;) {
    if (place.char !== 0 || servedVerse(verses, place.verseId) === undefined)
      return place
    const previous = verses.find(
      (verse) => nextVerse(verse.verseId) === place.verseId,
    )
    if (previous === undefined) return place
    place = { verseId: previous.verseId, char: previous.text.length }
  }
}

const tightened = (
  portions: readonly Portion[],
  verses: readonly VerseText[],
): Portion[] =>
  portions
    .map((portion) => ({
      ...portion,
      start: tightenedStart(portion.start, verses),
      end: tightenedEnd(portion.end, verses),
    }))
    .filter((portion) => before(portion.start, portion.end))

const adjoins = (
  end: Position,
  start: Position,
  verses: readonly VerseText[],
): boolean => {
  if (samePlace(end, start) || before(start, end)) return true
  const verse = servedVerse(verses, end.verseId)
  return (
    verse !== undefined &&
    end.char === verse.text.length &&
    start.char === 0 &&
    nextVerse(end.verseId) === start.verseId
  )
}

const joined = (
  portions: readonly Portion[],
  verses: readonly VerseText[],
): Portion[] => {
  const merged: Portion[] = []
  for (const portion of portions) {
    const open = merged[merged.length - 1]
    if (
      open !== undefined &&
      open.slot === portion.slot &&
      adjoins(open.end, portion.start, verses)
    ) {
      open.end = later(open.end, portion.end)
      continue
    }
    merged.push({ ...portion })
  }
  return merged
}

const settled = (
  portions: readonly Portion[],
  verses: readonly VerseText[],
): HighlightCue[] =>
  joined(
    [...tightened(portions, verses)].sort(
      (a, b) =>
        a.start.verseId - b.start.verseId ||
        a.start.char - b.start.char ||
        a.slot - b.slot,
    ),
    verses,
  ).map(cueOf)

const paintedPortions = (
  cues: readonly HighlightCue[],
  verses: readonly VerseText[],
): Portion[] =>
  verses.flatMap((verse) =>
    slotRuns(paintedSlots(cues, verse.verseId, verse.text.length)).map(
      (run) => ({
        slot: run.slot,
        start: { verseId: verse.verseId, char: run.start },
        end: { verseId: verse.verseId, char: run.end },
      }),
    ),
  )

export const applyHighlightStroke = (
  cues: readonly HighlightCue[],
  stroke: HighlightStroke,
  verses: readonly VerseText[],
): HighlightCue[] => {
  const stroked = servedRegions(stroke, verses)
  const slot = stroke.slot
  const painted =
    slot === null ? [] : stroked.map((region) => ({ slot, ...region }))
  return settled(
    [...outsideRegions(cues.map(portionOf), stroked), ...painted],
    verses,
  )
}

export const canonicalHighlightCues = (
  cues: readonly HighlightCue[],
  verses: readonly VerseText[],
): HighlightCue[] => {
  const unserved = cues.flatMap((cue) =>
    outsideRegions([portionOf(cue)], servedRegions(cue, verses)),
  )
  return settled([...unserved, ...paintedPortions(cues, verses)], verses)
}
