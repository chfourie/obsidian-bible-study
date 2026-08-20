import { highlightSpans } from '../highlights'
import { decodeVerseId, type HighlightCue } from '../reference'
import type { Passage, PassageVerse, VerseSegment } from './module-passage-source'
import type { ReferenceRenderModel } from './reference-render-model'
import { markSpanChannel } from './segment-spans'

export type VerseBlock = {
  verseId: number
  label: string | null
  segments: VerseSegment[]
  startsNewLine: boolean
}

const PSALMS_BOOK = 19

export const isPoetryVerse = (
  segments: VerseSegment[],
  book: number,
): boolean =>
  book === PSALMS_BOOK ||
  segments.some(
    (segment) =>
      segment.indent !== undefined || segment.psalmHeading === true,
  )

export type PassageView = {
  verses: VerseBlock[]
  attribution: string | null
  fallbackNotice: string | null
}

const spansMultipleChapters = (verses: PassageVerse[]): boolean => {
  const chapters = verses.map((verse) => decodeVerseId(verse.verseId).chapter)
  return chapters.some((chapter) => chapter !== chapters[0])
}

const verseLabels = (verses: PassageVerse[]): string[] => {
  const multiChapter = spansMultipleChapters(verses)
  let previousChapter: number | null = null
  return verses.map((passageVerse) => {
    const { chapter, verse } = decodeVerseId(passageVerse.verseId)
    const label =
      multiChapter && chapter !== previousChapter
        ? `${chapter}:${verse}`
        : `${verse}`
    previousChapter = chapter
    return label
  })
}

const highlightedSegments = (
  verse: PassageVerse,
  cues: readonly HighlightCue[],
): VerseSegment[] => {
  if (cues.length === 0) return verse.segments
  const textLength = verse.segments.reduce(
    (total, segment) => total + segment.text.length,
    0,
  )
  const spans = highlightSpans(cues, verse.verseId, textLength)
  return spans.length === 0
    ? verse.segments
    : markSpanChannel(verse.segments, spans, (segment, span) => {
        segment.highlightSlot = span.slot
      })
}

export const buildPassageView = (
  model: ReferenceRenderModel,
  passage: Extract<Passage, { status: 'ok' }>,
): PassageView => {
  const numbered =
    model.display === 'block' || passage.verses.length > 1
  const labels = verseLabels(passage.verses)
  const cues = passage.fallback === undefined ? model.highlights : []
  return {
    verses: passage.verses.map((verse, index) => ({
      verseId: verse.verseId,
      label: numbered ? labels[index] : null,
      segments: highlightedSegments(verse, cues),
      startsNewLine:
        verse.hasLineData === true || model.reference.book === PSALMS_BOOK,
    })),
    attribution:
      model.display === 'block'
        ? (model.book?.attribution ?? passage.attribution)
        : null,
    fallbackNotice:
      passage.fallback === undefined
        ? null
        : `${passage.fallback.served.toUpperCase()} (${passage.fallback.requested.toUpperCase()} unavailable)`,
  }
}

export const loadingText = (model: ReferenceRenderModel): string =>
  `Loading ${model.referenceText}…`

export const unavailableText = (model: ReferenceRenderModel): string =>
  model.translationId === null
    ? `${model.referenceText} unavailable — no translation installed`
    : `${model.referenceText} (${model.translationId.toUpperCase()}) unavailable offline`
