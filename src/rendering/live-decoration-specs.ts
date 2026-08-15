import { scanReferenceMatches } from '../reference'
import {
  modelFromParsed,
  type ReferenceRenderModel,
  type RenderContext,
} from './reference-render-model'

export type SelectionRange = {
  from: number
  to: number
}

export type LiveDecorationSpec = {
  start: number
  end: number
  model: ReferenceRenderModel
}

const touches = (spec: { start: number; end: number }, selection: SelectionRange): boolean =>
  selection.from <= spec.end && selection.to >= spec.start

export const liveDecorationSpecs = (
  docText: string,
  selections: readonly SelectionRange[],
  context: RenderContext,
): LiveDecorationSpec[] =>
  scanReferenceMatches(docText, {
    translationIds: context.knownTranslationIds,
  })
    .map((match) => ({
      start: match.start,
      end: match.end,
      model: modelFromParsed(match.parsed, context),
    }))
    .filter((spec) => !selections.some((selection) => touches(spec, selection)))
