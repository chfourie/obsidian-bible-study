import type { ModuleManifest } from './module-manifest'
import type { VerseContent } from './verse-content'

export type BookContent = Record<number, VerseContent>

export type NormalizedModule = {
  manifest: ModuleManifest
  books: Map<number, BookContent>
}

export type SourceInfo = {
  source: string
  sourceChecksum: string
}
