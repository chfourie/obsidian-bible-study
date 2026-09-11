import { highlightSpans } from '../highlights'
import {
  decodeVerseId,
  type HighlightCue,
  type Reference,
  type UnderlineCue,
} from '../reference'
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
import { isVerseGap } from './verse-gap'

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

// Why the passage stands an ellipsis in place of text. A Verse Gap is the
// only reason today; an Excerpt's cut is the next one, and two reasons meeting
// at one place still print one ellipsis.
export type PassageEllipsisReason = 'gap'

// One thing the passage prints, in reading order: a verse block, or an
// ellipsis standing between two of them. The ellipsis is an entry of its own
// rather than a flag on a block so that a renderer prints it once, however
// many reasons put it there.
export type PassageEntry =
  | { kind: 'verse'; verse: VerseBlock }
  | { kind: 'ellipsis'; reason: PassageEllipsisReason }

export type PassageView = {
  entries: PassageEntry[]
  attribution: string | null
  fallbackNotice: string | null
}

export const verseBlocks = (view: PassageView): VerseBlock[] =>
  view.entries.flatMap((entry) => (entry.kind === 'verse' ? [entry.verse] : []))

// Reading order with a Verse Gap ellipsis wherever the author skipped verses
// (spec §Verse Gap). Steps of one atom share a verse id, so a page walk's
// blocks never stand an ellipsis between the lines of one paragraph.
const withVerseGaps = (
  blocks: VerseBlock[],
  reference: Reference,
): PassageEntry[] => {
  const entries: PassageEntry[] = []
  let previousVerseId: number | null = null
  for (const verse of blocks) {
    if (
      previousVerseId !== null &&
      isVerseGap(previousVerseId, verse.verseId, reference)
    ) {
      entries.push({ kind: 'ellipsis', reason: 'gap' })
    }
    entries.push({ kind: 'verse', verse })
    previousVerseId = verse.verseId
  }
  return entries
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

// The two decoration channels a cue paints, each kept on its own (CONTEXT.md
// — Underline): a Highlight and an Underline may cover the same characters,
// so both are laid over the same segments and neither erases the other.
export type PaintedCues = {
  highlights: readonly HighlightCue[]
  underlines: readonly UnderlineCue[]
}

type SpanChannel = {
  cues: readonly HighlightCue[]
  mark: (segment: VerseSegment, slot: number) => void
}

const decoratedSegments = (
  verse: PassageVerse,
  cues: PaintedCues,
): VerseSegment[] => {
  if (cues.highlights.length === 0 && cues.underlines.length === 0) {
    return verse.segments
  }
  const textLength = verse.segments.reduce(
    (total, segment) => total + segment.text.length,
    0,
  )
  const channels: SpanChannel[] = [
    {
      cues: cues.highlights,
      mark: (segment, slot) => {
        segment.highlightSlot = slot
      },
    },
    {
      cues: cues.underlines,
      mark: (segment, slot) => {
        segment.underlineSlot = slot
      },
    },
  ]
  return channels.reduce<VerseSegment[]>((segments, channel) => {
    const spans = highlightSpans(channel.cues, verse.verseId, textLength)
    return spans.length === 0
      ? segments
      : markSpanChannel(segments, spans, (segment, span) =>
          channel.mark(segment, span.slot),
        )
  }, verse.segments)
}

const atomBlocks = (
  model: ReferenceRenderModel,
  verses: readonly PassageVerse[],
  cues: PaintedCues,
  numbered: boolean,
): VerseBlock[] => {
  const labels = verseLabels([...verses])
  return verses.map((verse, index) => ({
    verseId: verse.verseId,
    label: numbered ? labels[index] : null,
    letterLabel: null,
    segments: decoratedSegments(verse, cues),
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
  cues: PaintedCues,
  numbered: boolean,
): VerseBlock[] => {
  const labels = verseLabels([...verses])
  const atoms = verses.map((verse, index) => ({
    verseId: verse.verseId,
    label: labels[index],
    table: verse.table ?? null,
    segments: decoratedSegments(verse, cues),
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
  const cues: PaintedCues =
    passage.fallback === undefined
      ? { highlights: model.highlights, underlines: model.underlines }
      : { highlights: [], underlines: [] }
  const blocks =
    passage.steps === undefined
      ? atomBlocks(model, passage.verses, cues, numbered)
      : stepBlocks(model, passage.verses, passage.steps, cues, numbered)
  return {
    entries: withVerseGaps(blocks, model.reference),
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
