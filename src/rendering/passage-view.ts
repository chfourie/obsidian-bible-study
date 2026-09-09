import { highlightSpans } from '../highlights'
import { decodeVerseId, type HighlightCue } from '../reference'
import {
  lineLetterLabel,
  walkSteps,
  type Passage,
  type PassageStep,
  type PassageTableRow,
  type PassageVerse,
  type VerseSegment,
} from './module-passage-source'
import type { ReferenceRenderModel } from './reference-render-model'
import { markSpanChannel, stepSegments } from './segment-spans'

export type VerseBlock = {
  verseId: number
  label: string | null
  // The Line letter's label for the number slot — `6a` — when a block quote
  // walks a lettered line; inline omits letters (spec-books §4).
  letterLabel: string | null
  segments: VerseSegment[]
  startsNewLine: boolean
  // A stanza blank inside an atom (spec-books §11): the block opens a new
  // run rather than a new line.
  startsParagraph: boolean
  // Where the block's text starts in its atom's stored string, so a drag
  // over one step of a walk still maps to the atom's own offsets.
  textOffset: number
  // A Book atom flattened from a printed table: its rows, each the spans its
  // cells cover in this block's segments. Null for every other atom.
  table: PassageTableRow[] | null
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

const atomBlocks = (
  model: ReferenceRenderModel,
  verses: readonly PassageVerse[],
  cues: readonly HighlightCue[],
  numbered: boolean,
): VerseBlock[] => {
  const labels = verseLabels([...verses])
  return verses.map((verse, index) => ({
    verseId: verse.verseId,
    label: numbered ? labels[index] : null,
    letterLabel: null,
    segments: highlightedSegments(verse, cues),
    table: verse.table ?? null,
    startsNewLine:
      verse.hasLineData === true || model.reference.book === PSALMS_BOOK,
    startsParagraph: false,
    textOffset: 0,
  }))
}

// A walk's blocks, one per step (spec-books §4): the atom number at every
// entry into a different atom, the Line letter beside it in a block quote,
// and each step's segments cut from the atom's — highlights already on them,
// so a cue over 5:7 paints on every step of 7 wherever the page put it.
const stepBlocks = (
  model: ReferenceRenderModel,
  verses: readonly PassageVerse[],
  steps: readonly PassageStep[],
  cues: readonly HighlightCue[],
  numbered: boolean,
): VerseBlock[] => {
  const labels = verseLabels([...verses])
  const atoms = verses.map((verse, index) => ({
    verseId: verse.verseId,
    label: labels[index],
    table: verse.table ?? null,
    segments: highlightedSegments(verse, cues),
  }))
  return walkSteps(atoms, steps).map(({ step, atom, entersAtom }) => {
    const lined = step.line !== undefined
    return {
      verseId: step.verseId,
      label: numbered && entersAtom ? atom.label : null,
      letterLabel: model.display === 'block' ? lineLetterLabel(step) : null,
      segments: stepSegments(atom.segments, step.span),
      table: lined ? null : atom.table,
      startsNewLine: lined,
      startsParagraph:
        step.line !== undefined && step.line > 0 && step.startsParagraph === true,
      textOffset: step.span.start,
    }
  })
}

export const buildPassageView = (
  model: ReferenceRenderModel,
  passage: Extract<Passage, { status: 'ok' }>,
): PassageView => {
  const numbered =
    model.display === 'block' || passage.verses.length > 1
  const cues = passage.fallback === undefined ? model.highlights : []
  return {
    verses:
      passage.steps === undefined
        ? atomBlocks(model, passage.verses, cues, numbered)
        : stepBlocks(model, passage.verses, passage.steps, cues, numbered),
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
