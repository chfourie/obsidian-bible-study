import {
  classifyOptionTokens,
  tokenize,
  type ParsedReference,
  type ParseOptions,
} from './parse-reference'
import { decodeVerseId, makeVerseId } from './verse-id'
import { verseCount } from './versification'
import {
  enumerateVerseIds,
  rangeContains,
  type Reference,
} from './verse-range'

export type RelativeVerse = {
  chapter: number | null
  verse: number
}

export type RelativeSegment = {
  start: RelativeVerse
  end: RelativeVerse | null
}

export type ParsedRelativeReference = {
  spec: string
  parsed: ParsedReference
}

const RELATIVE_SEGMENT_PATTERN = /^(\d+)?:(\d+)(?:-(?:(\d+):)?(\d+))?$/

const parseSegment = (segment: string): RelativeSegment | null => {
  const match = RELATIVE_SEGMENT_PATTERN.exec(segment)
  if (!match) return null
  const [, startChapter, startVerse, endChapter, endVerse] = match
  return {
    start: {
      chapter: startChapter ? Number(startChapter) : null,
      verse: Number(startVerse),
    },
    end: endVerse
      ? {
          chapter: endChapter ? Number(endChapter) : null,
          verse: Number(endVerse),
        }
      : null,
  }
}

export const parseRelativeSpec = (spec: string): RelativeSegment[] | null => {
  const segments: RelativeSegment[] = []
  for (const part of spec.split(',')) {
    const segment = parseSegment(part)
    if (!segment) return null
    segments.push(segment)
  }
  return segments
}

const withinAnchor = (anchor: Reference, verseId: number): boolean =>
  anchor.ranges.some((range) => rangeContains(range, verseId))

const onlyChapterHolding = (
  anchor: Reference,
  verse: number,
): number | null => {
  const chapters = new Set(
    anchor.ranges
      .flatMap(enumerateVerseIds)
      .map(decodeVerseId)
      .filter((location) => location.verse === verse)
      .map((location) => location.chapter),
  )
  return chapters.size === 1 ? [...chapters][0] : null
}

const resolveVerse = (
  anchor: Reference,
  { chapter, verse }: RelativeVerse,
): number | null => {
  const resolvedChapter = chapter ?? onlyChapterHolding(anchor, verse)
  if (resolvedChapter === null) return null
  if (verse < 1 || verse > verseCount(anchor.book, resolvedChapter)) return null
  const verseId = makeVerseId(anchor.book, resolvedChapter, verse)
  return withinAnchor(anchor, verseId) ? verseId : null
}

export const resolveRelativeReference = (
  segments: readonly RelativeSegment[],
  anchor: ParsedReference,
): Reference | null => {
  if (segments.length !== 1 || segments[0].end !== null) return null
  const verseId = resolveVerse(anchor.reference, segments[0].start)
  if (verseId === null) return null
  return {
    book: anchor.reference.book,
    ranges: [{ startId: verseId, endId: verseId }],
  }
}

export const parseRelativeReference = (
  text: string,
  anchor: ParsedReference,
  options: ParseOptions = {},
): ParsedRelativeReference | null => {
  const [specToken, ...optionTokens] = tokenize(text)
  if (!specToken) return null
  const segments = parseRelativeSpec(specToken.text)
  if (!segments) return null
  const reference = resolveRelativeReference(segments, anchor)
  if (!reference) return null
  const classified = classifyOptionTokens(
    optionTokens,
    options.translationIds ?? [],
    reference,
  )
  return {
    spec: specToken.text,
    parsed: {
      reference,
      ...classified,
      translation: classified.translation ?? anchor.translation,
    },
  }
}
