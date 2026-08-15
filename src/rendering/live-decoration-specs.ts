import { scanReferenceMatches } from '../reference'
import {
  modelFromParsed,
  type ReferenceRenderModel,
  type RenderContext,
} from './reference-render-model'

export type DocRange = {
  from: number
  to: number
}

export type LiveDecorationSpec = {
  start: number
  end: number
  model: ReferenceRenderModel
}

type Span = { start: number; end: number }

const overlapsRange = (span: Span, range: DocRange): boolean =>
  span.start < range.to && span.end > range.from

const touches = (span: Span, selection: DocRange): boolean =>
  selection.from <= span.end && selection.to >= span.start

// Scans the full document so fence state, frontmatter, and escape context
// carry into the visible ranges, then keeps only the visible matches.
export const liveDecorationSpecs = (
  doc: string,
  visibleRanges: readonly DocRange[],
  selections: readonly DocRange[],
  context: RenderContext,
): LiveDecorationSpec[] =>
  scanReferenceMatches(doc, { translationIds: context.knownTranslationIds })
    .filter((match) => visibleRanges.some((range) => overlapsRange(match, range)))
    .filter((match) => !selections.some((selection) => touches(match, selection)))
    .map((match) => ({
      start: match.start,
      end: match.end,
      model: modelFromParsed(match.parsed, context),
    }))
