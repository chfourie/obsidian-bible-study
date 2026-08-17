// v2: verses may carry a per-verse line-break channel (StructuredVerse.lines).
// Purely additive — v1 modules (no line data) load and render unchanged.
export const MODULE_FORMAT_VERSION = 2

export type ModuleCapabilities = {
  strongsTagged: boolean
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
