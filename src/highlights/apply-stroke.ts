import {
  nextVerse,
  type ExcerptPart,
  type HighlightCue,
  type HighlightSlot,
  type UnderlineCue,
  type UnderlineSlot,
} from '../reference'
import {
  paintedSlots,
  rangeWithinVerse,
  slotRuns,
  type HighlightRange,
  type Slotted,
} from './highlight-spans'

export type VerseText = {
  verseId: number
  text: string
}

// A null slot erases: the eraser is a stroke like any other.
export type ChannelStroke<Slot extends number> = HighlightRange & {
  slot: Slot | null
}

export type HighlightStroke = ChannelStroke<HighlightSlot>

export type UnderlineStroke = ChannelStroke<UnderlineSlot>

// The excerpt channel has one implicit slot: Show paints it, Hide erases it,
// and the kept parts are what remains painted (spec — Stroke engine per
// channel).
export type ExcerptStroke = HighlightRange & { action: 'show' | 'hide' }

// A place in the passage: the character boundary before `char` of `verseId`.
type Position = {
  verseId: number
  char: number
}

type Portion<Slot extends number> = {
  slot: Slot
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

const portionOf = <Slot extends number>(cue: Slotted<Slot>): Portion<Slot> => ({
  slot: cue.slot,
  start: { verseId: cue.startVerseId, char: cue.startChar },
  end: { verseId: cue.endVerseId, char: cue.endChar },
})

const cueOf = <Slot extends number>(portion: Portion<Slot>): Slotted<Slot> => ({
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

const outsideRegion = <Slot extends number>(
  portion: Portion<Slot>,
  region: Region,
): Portion<Slot>[] => {
  if (!before(region.start, portion.end) || !before(portion.start, region.end))
    return [portion]
  const kept: Portion<Slot>[] = []
  if (before(portion.start, region.start))
    kept.push({ ...portion, end: region.start })
  if (before(region.end, portion.end))
    kept.push({ ...portion, start: region.end })
  return kept
}

const outsideRegions = <Slot extends number>(
  portions: readonly Portion<Slot>[],
  regions: readonly Region[],
): Portion<Slot>[] =>
  regions.reduce<Portion<Slot>[]>(
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

const tightened = <Slot extends number>(
  portions: readonly Portion<Slot>[],
  verses: readonly VerseText[],
): Portion<Slot>[] =>
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

const joined = <Slot extends number>(
  portions: readonly Portion<Slot>[],
  verses: readonly VerseText[],
): Portion<Slot>[] => {
  const merged: Portion<Slot>[] = []
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

const settled = <Slot extends number>(
  portions: readonly Portion<Slot>[],
  verses: readonly VerseText[],
): Slotted<Slot>[] =>
  joined(
    [...tightened(portions, verses)].sort(
      (a, b) =>
        a.start.verseId - b.start.verseId ||
        a.start.char - b.start.char ||
        a.slot - b.slot,
    ),
    verses,
  ).map(cueOf)

const paintedPortions = <Slot extends number>(
  cues: readonly Slotted<Slot>[],
  verses: readonly VerseText[],
): Portion<Slot>[] =>
  verses.flatMap((verse) =>
    slotRuns(paintedSlots(cues, verse.verseId, verse.text.length)).map(
      (run) => ({
        slot: run.slot,
        start: { verseId: verse.verseId, char: run.start },
        end: { verseId: verse.verseId, char: run.end },
      }),
    ),
  )

// One engine, one channel at a time: a stroke on the highlight list never
// sees the underline list, and neither sees the excerpt.
export const applyChannelStroke = <Slot extends number>(
  cues: readonly Slotted<Slot>[],
  stroke: ChannelStroke<Slot>,
  verses: readonly VerseText[],
): Slotted<Slot>[] => {
  const stroked = servedRegions(stroke, verses)
  const slot = stroke.slot
  const painted =
    slot === null ? [] : stroked.map((region) => ({ slot, ...region }))
  return settled(
    [...outsideRegions(cues.map(portionOf), stroked), ...painted],
    verses,
  )
}

export const canonicalChannelCues = <Slot extends number>(
  cues: readonly Slotted<Slot>[],
  verses: readonly VerseText[],
): Slotted<Slot>[] => {
  const unserved = cues.flatMap((cue) =>
    outsideRegions([portionOf(cue)], servedRegions(cue, verses)),
  )
  return settled([...unserved, ...paintedPortions(cues, verses)], verses)
}

export const applyHighlightStroke = (
  cues: readonly HighlightCue[],
  stroke: HighlightStroke,
  verses: readonly VerseText[],
): HighlightCue[] => applyChannelStroke(cues, stroke, verses)

export const applyUnderlineStroke = (
  cues: readonly UnderlineCue[],
  stroke: UnderlineStroke,
  verses: readonly VerseText[],
): UnderlineCue[] => applyChannelStroke(cues, stroke, verses)

const EXCERPT_SLOT = 1

type KeptPart = Slotted<typeof EXCERPT_SLOT>

const keptPart = (part: ExcerptPart): KeptPart => ({
  ...part,
  slot: EXCERPT_SLOT,
})

const excerptPart = ({ slot: _slot, ...part }: KeptPart): ExcerptPart => part

export const applyExcerptStroke = (
  parts: readonly ExcerptPart[],
  stroke: ExcerptStroke,
  verses: readonly VerseText[],
): ExcerptPart[] => {
  const { action, ...range } = stroke
  return applyChannelStroke(
    parts.map(keptPart),
    { ...range, slot: action === 'show' ? EXCERPT_SLOT : null },
    verses,
  ).map(excerptPart)
}
