import { scanReferenceMatches } from '../reference'
import {
  modelFromParsed,
  type ReferenceRenderModel,
  type RenderContext,
} from './reference-render-model'
import { scanChristQuotes } from './scan-christ-quotes'

export type DocRange = {
  from: number
  to: number
}

export type ReferenceDecorationSpec = {
  kind: 'reference'
  start: number
  end: number
  model: ReferenceRenderModel
}

// `prefix` is the c; the quote runs from the opening mark at `start` through
// the closing mark. The prefix is shown again, not the quote, while the
// cursor or a selection touches the quote.
export type ChristQuoteDecorationSpec = {
  kind: 'christ-quote'
  prefix: number
  start: number
  end: number
  prefixHidden: boolean
}

export type LiveDecorationSpec =
  | ReferenceDecorationSpec
  | ChristQuoteDecorationSpec

type Span = { start: number; end: number }

const overlapsRange = (span: Span, range: DocRange): boolean =>
  span.start < range.to && span.end > range.from

const touches = (span: Span, selection: DocRange): boolean =>
  selection.from <= span.end && selection.to >= span.start

const visible = (span: Span, visibleRanges: readonly DocRange[]): boolean =>
  visibleRanges.some((range) => overlapsRange(span, range))

const touched = (span: Span, selections: readonly DocRange[]): boolean =>
  selections.some((selection) => touches(span, selection))

const referenceSpecs = (
  doc: string,
  visibleRanges: readonly DocRange[],
  selections: readonly DocRange[],
  context: RenderContext,
): ReferenceDecorationSpec[] =>
  scanReferenceMatches(doc, { translationIds: context.knownTranslationIds })
    .filter((match) => visible(match, visibleRanges))
    .filter((match) => !touched(match, selections))
    .map((match) => ({
      kind: 'reference',
      start: match.start,
      end: match.end,
      model: modelFromParsed(match.parsed, context, match.relativeSpec),
    }))

const christQuoteSpecs = (
  doc: string,
  visibleRanges: readonly DocRange[],
  selections: readonly DocRange[],
): ChristQuoteDecorationSpec[] =>
  scanChristQuotes(doc)
    .map(({ prefix, close }) => ({ prefix, start: prefix + 1, end: close + 1 }))
    .filter((quote) => visible({ start: quote.prefix, end: quote.end }, visibleRanges))
    .map((quote) => ({
      kind: 'christ-quote',
      ...quote,
      prefixHidden: !touched({ start: quote.prefix, end: quote.end }, selections),
    }))

// Scans the full document so fence state, frontmatter, and escape context
// carry into the visible ranges, then keeps only the visible matches.
export const liveDecorationSpecs = (
  doc: string,
  visibleRanges: readonly DocRange[],
  selections: readonly DocRange[],
  context: RenderContext,
): LiveDecorationSpec[] => [
  ...referenceSpecs(doc, visibleRanges, selections, context),
  ...christQuoteSpecs(doc, visibleRanges, selections),
]
