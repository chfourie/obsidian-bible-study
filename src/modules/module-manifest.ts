export const MODULE_FORMAT_VERSION = 1

export type ModuleCapabilities = {
  strongsTagged: boolean
}

export type ModuleManifest = {
  id: string
  name: string
  language: string
  license: string
  source: string
  sourceChecksum: string
  formatVersion: number
  capabilities: ModuleCapabilities
}
