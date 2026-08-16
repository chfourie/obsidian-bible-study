import type { NormalizedModule } from './normalize-getbible-translation'

export type PrebuiltModuleDownload = {
  module: NormalizedModule
  checksum: string
}

export interface PrebuiltModuleSource {
  fetchModule(): Promise<PrebuiltModuleDownload>
  fetchChecksum(): Promise<string | null>
}
