import {
  formatReference,
  parseReference,
  type ParsedReference,
  type Reference,
} from '../reference'

export type RenderDisplay = 'chip' | 'inline' | 'block'

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

export const sameRenderModel = (
  a: ReferenceRenderModel,
  b: ReferenceRenderModel,
): boolean =>
  a.referenceText === b.referenceText &&
  a.translationId === b.translationId &&
  a.chipLabel === b.chipLabel &&
  a.display === b.display &&
  a.invalidTokens.length === b.invalidTokens.length &&
  a.invalidTokens.every((token, index) => token === b.invalidTokens[index])

export const buildReferenceRenderModel = (
  text: string,
  context: RenderContext,
): ReferenceRenderModel | null => {
  const parsed = parseReference(text, {
    translationIds: context.knownTranslationIds,
  })
  return parsed === null ? null : modelFromParsed(parsed, context)
}
