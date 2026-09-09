import type { ConcordanceIndex } from './concordance-index'
import type { ModuleManifest } from './module-manifest'
import type { FormatSpan, RefSpan, VerseContent } from './verse-content'

export type BookContent = Record<number, VerseContent>

// A section's opening quotation — chapter metadata, not an atom (ADR 0002),
// so it lives beside the content instead of inside it.
export type Epigraph = {
  quote: string
  attribution: string
  // The live citations in the attribution line, addressed by character offset
  // into it the way an atom's own ref spans are (spec-books §8).
  refs?: RefSpan[]
  // The quote's Editorial marks, the three channels an atom carries, over
  // the quote's text (spec-books §10).
  supplied?: FormatSpan[]
  marks?: FormatSpan[]
  emended?: FormatSpan[]
}

export type ModuleEpigraphs = Record<number, Epigraph[]>

export type NormalizedModule = {
  manifest: ModuleManifest
  books: Map<number, BookContent>
  epigraphs?: ModuleEpigraphs
  // Tagged Translations only, and derivable from the books beside it — a
  // module that arrives without one is indexed on the way into storage.
  concordance?: ConcordanceIndex
}

export type SourceInfo = {
  source: string
  sourceChecksum: string
}
