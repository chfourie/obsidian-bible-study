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

const touches = (
  spec: { start: number; end: number },
  selection: DocRange,
): boolean => selection.from <= spec.end && selection.to >= spec.start

export const liveDecorationSpecs = (
  visibleRanges: readonly DocRange[],
  sliceDoc: (from: number, to: number) => string,
  selections: readonly DocRange[],
  context: RenderContext,
): LiveDecorationSpec[] =>
  visibleRanges
    .flatMap(({ from, to }) =>
      scanReferenceMatches(sliceDoc(from, to), {
        translationIds: context.knownTranslationIds,
      }).map((match) => ({
        start: from + match.start,
        end: from + match.end,
        model: modelFromParsed(match.parsed, context),
      })),
    )
    .filter((spec) => !selections.some((selection) => touches(spec, selection)))
