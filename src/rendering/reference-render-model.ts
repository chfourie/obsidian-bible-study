import {
  formatReference,
  parseReference,
  type ParsedReference,
  type Reference,
} from '../reference'

export type RenderDisplay = 'chip' | 'inline' | 'callout'

export type RenderContext = {
  knownTranslationIds: readonly string[]
  defaultTranslationId: string | null
}

export type ReferenceRenderModel = {
  reference: Reference
  referenceText: string
  translationId: string | null
  chipLabel: string | null
  display: RenderDisplay
  invalidTokens: string[]
}

export const modelFromParsed = (
  parsed: ParsedReference,
  context: RenderContext,
): ReferenceRenderModel => ({
  reference: parsed.reference,
  referenceText: formatReference(parsed.reference),
  translationId: parsed.translation ?? context.defaultTranslationId,
  chipLabel: parsed.translation?.toUpperCase() ?? null,
  display: parsed.display ?? 'chip',
  invalidTokens: parsed.invalidTokens.map((token) => token.text),
})

export const buildReferenceRenderModel = (
  text: string,
  context: RenderContext,
): ReferenceRenderModel | null => {
  const parsed = parseReference(text, {
    translationIds: context.knownTranslationIds,
  })
  return parsed === null ? null : modelFromParsed(parsed, context)
}
