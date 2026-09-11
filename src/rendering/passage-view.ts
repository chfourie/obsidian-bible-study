import { highlightSpans, rangeWithinVerse, type Slotted } from '../highlights'
import {
  decodeVerseId,
  type ExcerptPart,
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
import {
  keptSpans,
  markSpanChannel,
  stepSegments,
  type TextSpan,
} from './segment-spans'
import { isVerseGap, PASSAGE_ELLIPSIS } from './verse-gap'

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

// Why the passage stands an ellipsis in place of text: a Verse Gap, or an
// Excerpt's cut that left a whole block out. Two reasons meeting at one place
// still print one ellipsis.
export type PassageEllipsisReason = 'gap' | 'excerpt'

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

export type PassageViewOptions = {
  // Passage Editing shows the whole passage with the cut text faded, not
  // hidden (CONTEXT.md — Passage Editing): with elision off the segments
  // outside the kept parts are flagged elided and no ellipsis stands.
  elision?: boolean
}

const ellipsisSegment = (): VerseSegment => ({
  text: PASSAGE_ELLIPSIS,
  redLetter: false,
  ellipsis: true,
})

const textLengthOf = (segments: readonly VerseSegment[]): number =>
  segments.reduce((total, segment) => total + segment.text.length, 0)

// The stretches of one block that the Excerpt keeps, in the block's own
// offsets: each part's span within the atom, shifted to where the block's
// text starts and cut down to what the block prints.
const keptInBlock = (
  block: VerseBlock,
  excerpt: readonly ExcerptPart[],
): TextSpan[] => {
  const end = block.textOffset + textLengthOf(block.segments)
  return keptSpans(
    excerpt.flatMap((part) => {
      const span = rangeWithinVerse(part, block.verseId, end)
      return span === null ? [] : [span]
    }),
    block.textOffset,
    end,
  )
}

const withoutSpans = (spans: readonly TextSpan[], length: number): TextSpan[] => {
  const gaps: TextSpan[] = []
  let start = 0
  for (const span of spans) {
    if (span.start > start) gaps.push({ start, end: span.start })
    start = span.end
  }
  if (start < length) gaps.push({ start, end: length })
  return gaps
}

const lineHeadOf = ({
  lineStart,
  lineBreakBefore,
}: VerseSegment): Pick<VerseSegment, 'lineStart' | 'lineBreakBefore'> => ({
  ...(lineStart === true ? { lineStart } : {}),
  ...(lineBreakBefore === true ? { lineBreakBefore } : {}),
})

// The block's segments cut to the kept spans, an ellipsis standing at every
// cut: before the first kept stretch when it does not start the block, after
// the last when it does not end it, and between two of them. The first
// stretch after a cut states its own offset, since the block's count no
// longer reaches it, and opens the line the cut took the head of, so a
// poetry line keeps its break when only its tail is kept. Every segment has
// text — the source cuts at distinct offsets — so an elided piece is never
// an empty one carrying line structure alone.
const elidedSegments = (
  block: VerseBlock,
  kept: readonly TextSpan[],
): VerseSegment[] => {
  const covered = new Set<VerseSegment>()
  const pieces = markSpanChannel(block.segments, kept, (piece) => {
    covered.add(piece)
  })
  const elided: VerseSegment[] = []
  let offset = 0
  let cut = false
  let cutLineHead: VerseSegment | null = null
  for (const piece of pieces) {
    if (covered.has(piece)) {
      if (cut) {
        const lineHead =
          cutLineHead === null || piece.lineStart === true
            ? {}
            : lineHeadOf(cutLineHead)
        elided.push(ellipsisSegment())
        elided.push({ ...piece, ...lineHead, textOffset: block.textOffset + offset })
      } else elided.push(piece)
      cut = false
      cutLineHead = null
    } else {
      cut = true
      if (piece.lineStart === true) cutLineHead = piece
    }
    offset += piece.text.length
  }
  if (cut) elided.push(ellipsisSegment())
  return elided
}

// Elision is applied last (spec #161, Passage view model): after the cue
// channels painted, each block is cut to its kept parts, and a block with
// nothing kept collapses to one ellipsis. A table atom stays whole — its
// cells read the atom's own offsets, and no drag over a table ever made an
// excerpt to begin with.
const excerptedEntry = (
  block: VerseBlock,
  excerpt: readonly ExcerptPart[],
  elision: boolean,
): PassageEntry => {
  if (excerpt.length === 0 || block.table !== null) {
    return { kind: 'verse', verse: block }
  }
  const kept = keptInBlock(block, excerpt)
  if (!elision) {
    const outside = withoutSpans(kept, textLengthOf(block.segments))
    const segments = markSpanChannel(block.segments, outside, (piece) => {
      piece.elided = true
    })
    return { kind: 'verse', verse: { ...block, segments } }
  }
  if (kept.length === 0) return { kind: 'ellipsis', reason: 'excerpt' }
  return { kind: 'verse', verse: { ...block, segments: elidedSegments(block, kept) } }
}

const isEllipsis = (segment: VerseSegment | undefined): boolean =>
  segment?.ellipsis === true

const endsInEllipsis = (entry: PassageEntry): boolean =>
  entry.kind === 'ellipsis' ||
  isEllipsis(entry.verse.segments[entry.verse.segments.length - 1])

const startsInEllipsis = (entry: PassageEntry): boolean =>
  entry.kind === 'ellipsis' || isEllipsis(entry.verse.segments[0])

const withoutLeadingEllipsis = (block: VerseBlock): VerseBlock => ({
  ...block,
  segments: block.segments.slice(1),
})

// Two ellipses at one place print as one (spec #161, story 63): an ellipsis
// entry — a Verse Gap or a block cut away whole — folds into a cut ending the
// block before it or opening the block after it, and a cut spanning two steps
// of one atom is one cut. Cuts of two different verses stay each verse's own:
// a verse number or a line stands between them.
const collapsedEllipses = (entries: readonly PassageEntry[]): PassageEntry[] => {
  const collapsed: PassageEntry[] = []
  entries.forEach((entry, index) => {
    const previous = collapsed[collapsed.length - 1]
    const next = entries[index + 1]
    if (entry.kind === 'ellipsis') {
      const folded =
        (previous !== undefined && endsInEllipsis(previous)) ||
        (next !== undefined && startsInEllipsis(next))
      if (!folded) collapsed.push(entry)
      return
    }
    const continuesCut =
      previous?.kind === 'verse' &&
      previous.verse.verseId === entry.verse.verseId &&
      endsInEllipsis(previous) &&
      startsInEllipsis(entry)
    collapsed.push(
      continuesCut
        ? { kind: 'verse', verse: withoutLeadingEllipsis(entry.verse) }
        : entry,
    )
  })
  return collapsed
}

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
  cues: readonly Slotted<number>[]
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
  options: PassageViewOptions = {},
): PassageView => {
  const numbered =
    model.display === 'block' || passage.verses.length > 1
  const served = passage.fallback === undefined
  const cues: PaintedCues = served
    ? { highlights: model.highlights, underlines: model.underlines }
    : { highlights: [], underlines: [] }
  const excerpt = served ? model.excerpt : []
  const blocks =
    passage.steps === undefined
      ? atomBlocks(model, passage.verses, cues, numbered)
      : stepBlocks(model, passage.verses, passage.steps, cues, numbered)
  const entries = withVerseGaps(blocks, model.reference).map((entry) =>
    entry.kind === 'verse'
      ? excerptedEntry(entry.verse, excerpt, options.elision ?? true)
      : entry,
  )
  return {
    entries: collapsedEllipses(entries),
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
