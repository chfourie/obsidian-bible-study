import { requestUrl } from 'obsidian'
import type { TextTransport } from './getbible-client'
import type { ModuleManifest } from './module-manifest'
import type { NormalizedModule } from './normalize-getbible-translation'
import type {
  PrebuiltModuleDownload,
  PrebuiltModuleSource,
} from './prebuilt-module-source'
import type { VerseContent } from './verse-content'

const RELEASE_BASE_URL =
  'https://github.com/chfourie/obsidian-bible-study/releases/download/bsb-module'

export const BSB_ARTIFACT_URL = `${RELEASE_BASE_URL}/bsb-module.json`
export const BSB_CHECKSUMS_URL = `${RELEASE_BASE_URL}/checksums.json`

export const BSB_MODULE_ID = 'bsb'

export type BsbArtifact = {
  manifest: Omit<ModuleManifest, 'source' | 'sourceChecksum'>
  books: Record<number, Record<number, VerseContent>>
}

const requestUrlTransport: TextTransport = async (url) =>
  (await requestUrl({ url })).text

const sha256Hex = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export class BsbReleaseClient implements PrebuiltModuleSource {
  constructor(private readonly fetchText: TextTransport = requestUrlTransport) {}

  async fetchModule(): Promise<PrebuiltModuleDownload> {
    const raw = await this.fetchText(BSB_ARTIFACT_URL)
    const artifact = JSON.parse(raw) as BsbArtifact
    const checksum = await sha256Hex(raw)
    const module: NormalizedModule = {
      manifest: {
        ...artifact.manifest,
        source: BSB_ARTIFACT_URL,
        sourceChecksum: checksum,
      },
      books: new Map(
        Object.entries(artifact.books).map(([book, content]) => [
          Number(book),
          content,
        ]),
      ),
    }
    return { module, checksum }
  }

  async fetchChecksum(): Promise<string | null> {
    const raw = await this.fetchText(BSB_CHECKSUMS_URL)
    const checksums = JSON.parse(raw) as Record<string, string>
    return checksums[BSB_MODULE_ID] ?? null
  }
}
