import {
  bookCitation,
  formatReference,
  parseReference,
  sameExcerptPart,
  sameHighlightCue,
  sameUnderlineCue,
  type BookCitation,
  type ExcerptPart,
  type HighlightCue,
  type ParsedReference,
  type Reference,
  type UnderlineCue,
} from '../reference'

export type RenderDisplay = 'chip' | 'inline' | 'block'

export type RenderContext = {
  knownTranslationIds: readonly string[]
  defaultTranslationId: string | null
  pageBreaks: boolean
}

export type ReferenceRenderModel = {
  reference: Reference
  referenceText: string
  translationId: string | null
  chipLabel: string | null
  display: RenderDisplay
  invalidTokens: string[]
  highlights: HighlightCue[]
  underlines: UnderlineCue[]
  excerpt: ExcerptPart[]
  relativeSpec: string | null
  // Present for a non-biblical book: MLA locators and the full citation the
  // chip and block attribution line render from (spec-books §4).
  book: BookCitation | null
}

// A book has one edition, so its module fills the translation slot outright —
// never the configured default, never a token (spec-books §6).
export const modelFromParsed = (
  parsed: ParsedReference,
  context: RenderContext,
  relativeSpec: string | null = null,
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
    underlines: parsed.underlines,
    excerpt: parsed.excerpt,
    relativeSpec,
    book,
  }
}

const sameList = <T>(
  a: readonly T[],
  b: readonly T[],
  same: (x: T, y: T) => boolean,
): boolean =>
  a.length === b.length && a.every((item, index) => same(item, b[index]))

export const sameRenderModel = (
  a: ReferenceRenderModel,
  b: ReferenceRenderModel,
): boolean =>
  a.referenceText === b.referenceText &&
  a.translationId === b.translationId &&
  a.chipLabel === b.chipLabel &&
  a.display === b.display &&
  a.relativeSpec === b.relativeSpec &&
  sameList(a.invalidTokens, b.invalidTokens, (x, y) => x === y) &&
  sameList(a.highlights, b.highlights, sameHighlightCue) &&
  sameList(a.underlines, b.underlines, sameUnderlineCue) &&
  sameList(a.excerpt, b.excerpt, sameExcerptPart)

export const buildReferenceRenderModel = (
  text: string,
  context: RenderContext,
): ReferenceRenderModel | null => {
  const parsed = parseReference(text, {
    translationIds: context.knownTranslationIds,
  })
  return parsed === null ? null : modelFromParsed(parsed, context)
}
