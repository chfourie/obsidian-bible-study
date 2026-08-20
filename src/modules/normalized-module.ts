import type { ModuleManifest } from './module-manifest'
import type { VerseContent } from './verse-content'

export type BookContent = Record<number, VerseContent>

// A section's opening quotation — chapter metadata, not an atom (ADR 0002),
// so it lives beside the content instead of inside it.
export type Epigraph = {
  quote: string
  attribution: string
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
