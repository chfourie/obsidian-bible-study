// v2: verses may carry optional per-verse channels beside the flat text —
// lines (poetry/paragraph structure), red (words of Christ), and supplied
// (translator-added words). Purely additive — v1 modules load and render
// unchanged, and readers ignore channels they don't know.
// v3: the Strong's Dictionaries store entries at extended-number granularity,
// with their family groupings, morphology, and Strong's 1890 derivations.
// A v2 dictionary carries none of it, so installs rebuild on the bump.
// v4: a Tagged Translation stores its Concordance Index beside its books.
// The index is derived from the tagging the module already carries, so an
// installed translation is re-indexed in place rather than re-downloaded.
export const MODULE_FORMAT_VERSION = 4

// The oldest stored translation whose content is already everything the
// current format asks of it. Later versions added only what can be re-derived
// from what such a module carries; anything older genuinely lacks content
// (v2's line, red-letter and supplied-word channels) that only a re-download
// brings back.
export const TRANSLATION_CONTENT_VERSION = 2

export type ModuleCapabilities = {
  strongsTagged: boolean
  redLetter?: boolean
  suppliedWords?: boolean
  poetry?: boolean
}

export type ModuleKind = 'translation' | 'strongs-dictionaries' | 'book'

// One addressable section of a book: its chapter number in the BBBCCCVVV id
// space, its display name, and how many paragraph atoms it holds. The whole
// table is the book's versification data (spec-books §1). `named` marks a
// section the printed work carries no chapter number for — its name replaces
// the chapter locator when a reference to it is displayed (§4).
export type BookSection = {
  chapter: number
  name: string
  paragraphs: number
  named?: boolean
}

export type BookMetadata = {
  number: number
  editionCode: string
  author: string
  year: number
  abbreviation: string
  aliases?: string[]
  sections: BookSection[]
}

export type ModuleManifest = {
  id: string
  name: string
  language: string
  license: string
  source: string
  sourceChecksum: string
  formatVersion: number
  // Absent means 'translation' — manifests written before kinds existed.
  kind?: ModuleKind
  capabilities: ModuleCapabilities
  // Required when kind is 'book', absent otherwise.
  book?: BookMetadata
}

export type BookManifest = ModuleManifest & {
  kind: 'book'
  book: BookMetadata
}

export const isTranslationManifest = (manifest: ModuleManifest): boolean =>
  manifest.kind === undefined || manifest.kind === 'translation'

export const isBookManifest = (
  manifest: ModuleManifest,
): manifest is BookManifest =>
  manifest.kind === 'book' && manifest.book !== undefined
