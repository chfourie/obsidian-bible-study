import type { ModuleManifest } from './module-manifest'
import type { RefSpan, VerseContent } from './verse-content'

export type BookContent = Record<number, VerseContent>

// A section's opening quotation — chapter metadata, not an atom (ADR 0002),
// so it lives beside the content instead of inside it.
export type Epigraph = {
  quote: string
  attribution: string
  // The live citations in the attribution line, addressed by character offset
  // into it the way an atom's own ref spans are (spec-books §8).
  refs?: RefSpan[]
}

export type ModuleEpigraphs = Record<number, Epigraph[]>

export type NormalizedModule = {
  manifest: ModuleManifest
  books: Map<number, BookContent>
  epigraphs?: ModuleEpigraphs
}

export type SourceInfo = {
  source: string
  sourceChecksum: string
}
