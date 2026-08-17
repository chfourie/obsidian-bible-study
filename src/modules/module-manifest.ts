// v2: verses may carry optional per-verse channels beside the flat text —
// lines (poetry/paragraph structure), red (words of Christ), and supplied
// (translator-added words). Purely additive — v1 modules load and render
// unchanged, and readers ignore channels they don't know.
export const MODULE_FORMAT_VERSION = 2

export type ModuleCapabilities = {
  strongsTagged: boolean
  redLetter?: boolean
  suppliedWords?: boolean
  poetry?: boolean
}

export type ModuleKind = 'translation' | 'strongs-dictionaries'

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
}

export const isTranslationManifest = (manifest: ModuleManifest): boolean =>
  manifest.kind === undefined || manifest.kind === 'translation'
