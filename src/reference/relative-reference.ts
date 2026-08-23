import {
  classifyOptionTokens,
  tokenize,
  type ParsedReference,
  type ParseOptions,
  type ReferenceToken,
} from './parse-reference'
import { decodeVerseId, makeVerseId } from './verse-id'
import { verseCount } from './versification'
import {
  enumerateVerseIds,
  mergeRanges,
  rangeContains,
  type Reference,
  type VerseRange,
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

const RELATIVE_SEGMENT_PATTERN = /^(\d+)?:(\d+)(?:-(?:(\d+)?:)?(\d+))?$/

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

const locateVerse = (
  anchor: Reference,
  chapter: number,
  verse: number,
): number | null => {
  if (verse < 1 || verse > verseCount(anchor.book, chapter)) return null
  const verseId = makeVerseId(anchor.book, chapter, verse)
  return withinAnchor(anchor, verseId) ? verseId : null
}

const chapterFor = (
  anchor: Reference,
  { chapter, verse }: RelativeVerse,
  currentChapter: number | null,
): number | null => chapter ?? currentChapter ?? onlyChapterHolding(anchor, verse)

const resolveSegment = (
  anchor: Reference,
  segment: RelativeSegment,
  currentChapter: number | null,
): { range: VerseRange; chapter: number } | null => {
  const startChapter = chapterFor(anchor, segment.start, currentChapter)
  if (startChapter === null) return null
  const startId = locateVerse(anchor, startChapter, segment.start.verse)
  if (startId === null) return null
  if (segment.end === null) {
    return { range: { startId, endId: startId }, chapter: startChapter }
  }
  const endChapter = segment.end.chapter ?? startChapter
  const endId = locateVerse(anchor, endChapter, segment.end.verse)
  if (endId === null || endId < startId) return null
  const range = { startId, endId }
  if (!enumerateVerseIds(range).every((id) => withinAnchor(anchor, id))) {
    return null
  }
  return { range, chapter: endChapter }
}

export const resolveRelativeReference = (
  segments: readonly RelativeSegment[],
  anchor: ParsedReference,
): Reference | null => {
  const ranges: VerseRange[] = []
  let currentChapter: number | null = null
  for (const segment of segments) {
    const resolved = resolveSegment(anchor.reference, segment, currentChapter)
    if (!resolved) return null
    ranges.push(resolved.range)
    currentChapter = resolved.chapter
  }
  if (ranges.length === 0) return null
  return { book: anchor.reference.book, ranges: mergeRanges(ranges) }
}

const continuesList = (spec: string, next: ReferenceToken | undefined) =>
  next !== undefined && (spec.endsWith(',') || next.text.startsWith(','))

const takeSpecTokens = (
  tokens: ReferenceToken[],
): { spec: string; optionTokens: ReferenceToken[] } | null => {
  if (tokens.length === 0) return null
  let used = 1
  let spec = tokens[0].text
  while (continuesList(spec, tokens[used])) {
    spec += tokens[used].text
    used += 1
  }
  return { spec, optionTokens: tokens.slice(used) }
}

export const parseRelativeReference = (
  text: string,
  anchor: ParsedReference,
  options: ParseOptions = {},
): ParsedRelativeReference | null => {
  const tokens = tokenize(text)
  const taken = takeSpecTokens(tokens)
  if (!taken) return null
  const segments = parseRelativeSpec(taken.spec)
  if (!segments) return null
  const reference = resolveRelativeReference(segments, anchor)
  if (!reference) return null
  const classified = classifyOptionTokens(
    taken.optionTokens,
    options.translationIds ?? [],
    reference,
  )
  const specEnd = tokens[tokens.length - taken.optionTokens.length - 1].end
  return {
    spec: text.slice(tokens[0].start, specEnd),
    parsed: {
      reference,
      ...classified,
      translation: classified.translation ?? anchor.translation,
    },
  }
}
