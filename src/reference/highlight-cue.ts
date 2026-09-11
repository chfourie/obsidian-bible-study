import { decodeVerseId, makeVerseId } from './verse-id'
import { verseCount } from './versification'
import { rangeContains, type Reference } from './verse-range'

export const HIGHLIGHT_SLOTS = [1, 2, 3, 4, 5] as const

export type HighlightSlot = (typeof HIGHLIGHT_SLOTS)[number]

export const isHighlightSlot = (value: number): value is HighlightSlot =>
  HIGHLIGHT_SLOTS.some((slot) => slot === value)

export const UNDERLINE_SLOTS = [1, 2, 3, 4, 5] as const

export type UnderlineSlot = (typeof UNDERLINE_SLOTS)[number]

export const isUnderlineSlot = (value: number): value is UnderlineSlot =>
  UNDERLINE_SLOTS.some((slot) => slot === value)

// The endpoints every cue family shares (CONTEXT.md — Highlight Cue):
// character offsets into one translation's verse text, end exclusive.
export type CueRange = {
  startVerseId: number
  startChar: number
  endVerseId: number
  endChar: number
}

export type HighlightCue = CueRange & { slot: HighlightSlot }

export type UnderlineCue = CueRange & { slot: UnderlineSlot }

// An Excerpt part has no slot: there is one excerpt channel per occurrence.
export type ExcerptPart = CueRange

export type CueToken =
  | { family: 'highlight'; cue: HighlightCue }
  | { family: 'underline'; cue: UnderlineCue }
  | { family: 'excerpt'; part: ExcerptPart }

const CUE_PATTERN =
  /^([hux])(\d*)\/(?:(\d+):)?(\d+)\.(\d+)-(?:(?:(\d+):)?(\d+)\.)?(\d+)$/i

const verseIdIn = (
  reference: Reference,
  chapter: number,
  verse: number,
): number | null => {
  if (verse < 1 || verse > verseCount(reference.book, chapter)) return null
  return makeVerseId(reference.book, chapter, verse)
}

const inheritedChapter = (reference: Reference): number =>
  decodeVerseId(reference.ranges[0].startId).chapter

const addressesReference = (reference: Reference, verseId: number): boolean =>
  reference.ranges.some((range) => rangeContains(range, verseId))

const cueRangeOf = (
  match: RegExpExecArray,
  reference: Reference,
): CueRange | null => {
  const [
    ,
    ,
    ,
    startChapter,
    startVerse,
    rawStartChar,
    endChapter,
    endVerse,
    rawEndChar,
  ] = match

  const chapter = inheritedChapter(reference)
  const startVerseId = verseIdIn(
    reference,
    startChapter ? Number(startChapter) : chapter,
    Number(startVerse),
  )
  if (startVerseId === null) return null
  const endVerseId =
    endVerse === undefined
      ? startVerseId
      : verseIdIn(
          reference,
          endChapter ? Number(endChapter) : chapter,
          Number(endVerse),
        )
  if (endVerseId === null || endVerseId < startVerseId) return null
  if (
    !addressesReference(reference, startVerseId) ||
    !addressesReference(reference, endVerseId)
  )
    return null

  const startChar = Number(rawStartChar)
  const endChar = Number(rawEndChar)
  if (startVerseId === endVerseId && endChar <= startChar) return null

  return { startVerseId, startChar, endVerseId, endChar }
}

export const parseCueToken = (
  text: string,
  reference: Reference,
): CueToken | null => {
  const match = CUE_PATTERN.exec(text)
  if (!match) return null
  const range = cueRangeOf(match, reference)
  if (range === null) return null
  const family = match[1].toLowerCase()
  const rawSlot = match[2]
  if (family === 'x')
    return rawSlot === '' ? { family: 'excerpt', part: range } : null
  if (rawSlot === '') return null
  const slot = Number(rawSlot)
  if (family === 'h') {
    return isHighlightSlot(slot)
      ? { family: 'highlight', cue: { ...range, slot } }
      : null
  }
  return isUnderlineSlot(slot)
    ? { family: 'underline', cue: { ...range, slot } }
    : null
}

const endpointText = (
  verseId: number,
  char: number,
  inherited: number,
): string => {
  const { chapter, verse } = decodeVerseId(verseId)
  const verseText = chapter === inherited ? `${verse}` : `${chapter}:${verse}`
  return `${verseText}.${char}`
}

const cueRangeText = (range: CueRange, reference: Reference): string => {
  const inherited = inheritedChapter(reference)
  const start = endpointText(range.startVerseId, range.startChar, inherited)
  const end = endpointText(range.endVerseId, range.endChar, inherited)
  return `${start}-${end}`
}

export const formatHighlightCue = (
  cue: HighlightCue,
  reference: Reference,
): string => `h${cue.slot}/${cueRangeText(cue, reference)}`

export const formatUnderlineCue = (
  cue: UnderlineCue,
  reference: Reference,
): string => `u${cue.slot}/${cueRangeText(cue, reference)}`

export const formatExcerptPart = (
  part: ExcerptPart,
  reference: Reference,
): string => `x/${cueRangeText(part, reference)}`

// Loose on purpose: a malformed token of any family is still a cue token the
// rewriter sweeps away rather than user text it must preserve.
export const isCueToken = (text: string): boolean => /^[hux]\d*\//i.test(text)

export const sameCueRange = (a: CueRange, b: CueRange): boolean =>
  a.startVerseId === b.startVerseId &&
  a.startChar === b.startChar &&
  a.endVerseId === b.endVerseId &&
  a.endChar === b.endChar

export const sameHighlightCue = (a: HighlightCue, b: HighlightCue): boolean =>
  a.slot === b.slot && sameCueRange(a, b)

export const sameUnderlineCue = (a: UnderlineCue, b: UnderlineCue): boolean =>
  a.slot === b.slot && sameCueRange(a, b)

export const sameExcerptPart = sameCueRange
