import type { NormalizedModule } from './normalized-module'

export type PrebuiltModuleDownload = {
  module: NormalizedModule
  checksum: string
}

export interface PrebuiltModuleSource {
  fetchModule(): Promise<PrebuiltModuleDownload>
  fetchChecksum(): Promise<string | null>
}
