import {
  bookCitation,
  formatReference,
  parseReference,
  sameHighlightCue,
  type BookCitation,
  type HighlightCue,
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
  highlights: HighlightCue[]
  // Present for a non-biblical book: MLA locators and the full citation the
  // chip and block attribution line render from (spec-books §4).
  book: BookCitation | null
}

// A book has one edition, so its module fills the translation slot outright —
// never the configured default, never a token (spec-books §6).
export const modelFromParsed = (
  parsed: ParsedReference,
  context: RenderContext,
): ReferenceRenderModel => {
  const book = bookCitation(parsed.reference)
  return {
    reference: parsed.reference,
    referenceText: book?.reference ?? formatReference(parsed.reference),
    translationId:
      book?.moduleId ?? parsed.translation ?? context.defaultTranslationId,
    chipLabel:
      book === null ? (parsed.translation?.toUpperCase() ?? null) : null,
    display: parsed.display ?? 'chip',
    invalidTokens: parsed.invalidTokens.map((token) => token.text),
    highlights: parsed.highlights,
    book,
  }
}

export const sameRenderModel = (
  a: ReferenceRenderModel,
  b: ReferenceRenderModel,
): boolean =>
  a.referenceText === b.referenceText &&
  a.translationId === b.translationId &&
  a.chipLabel === b.chipLabel &&
  a.display === b.display &&
  a.invalidTokens.length === b.invalidTokens.length &&
  a.invalidTokens.every((token, index) => token === b.invalidTokens[index]) &&
  a.highlights.length === b.highlights.length &&
  a.highlights.every((cue, index) => sameHighlightCue(cue, b.highlights[index]))

export const buildReferenceRenderModel = (
  text: string,
  context: RenderContext,
): ReferenceRenderModel | null => {
  const parsed = parseReference(text, {
    translationIds: context.knownTranslationIds,
  })
  return parsed === null ? null : modelFromParsed(parsed, context)
}
