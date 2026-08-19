import { decodeVerseId, makeVerseId } from './verse-id'
import { verseCount } from './versification'
import { rangeContains, type Reference } from './verse-range'

export type HighlightCue = {
  slot: number
  startVerseId: number
  startChar: number
  endVerseId: number
  endChar: number
}

export const HIGHLIGHT_SLOTS: readonly number[] = [1, 2, 3, 4, 5]

const CUE_PATTERN =
  /^h(\d+)\/(?:(\d+):)?(\d+)\.(\d+)-(?:(?:(\d+):)?(\d+)\.)?(\d+)$/i

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

export const parseHighlightCue = (
  text: string,
  reference: Reference,
): HighlightCue | null => {
  const match = CUE_PATTERN.exec(text)
  if (!match) return null
  const [
    ,
    rawSlot,
    startChapter,
    startVerse,
    rawStartChar,
    endChapter,
    endVerse,
    rawEndChar,
  ] = match

  const slot = Number(rawSlot)
  if (!HIGHLIGHT_SLOTS.includes(slot)) return null

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

  return { slot, startVerseId, startChar, endVerseId, endChar }
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

export const formatHighlightCue = (
  cue: HighlightCue,
  reference: Reference,
): string => {
  const inherited = inheritedChapter(reference)
  const start = endpointText(cue.startVerseId, cue.startChar, inherited)
  const end = endpointText(cue.endVerseId, cue.endChar, inherited)
  return `h${cue.slot}/${start}-${end}`
}

export const isHighlightCueToken = (text: string): boolean =>
  /^h\d+\//i.test(text)

export const sameHighlightCue = (a: HighlightCue, b: HighlightCue): boolean =>
  a.slot === b.slot &&
  a.startVerseId === b.startVerseId &&
  a.startChar === b.startChar &&
  a.endVerseId === b.endVerseId &&
  a.endChar === b.endChar
