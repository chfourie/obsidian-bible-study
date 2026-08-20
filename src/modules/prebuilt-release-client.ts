import { requestUrl } from 'obsidian'
import type { TextTransport } from './translation-source'
import type { ModuleManifest } from './module-manifest'
import type {
  BookContent,
  ModuleEpigraphs,
  NormalizedModule,
} from './normalized-module'
import type {
  PrebuiltModuleDownload,
  PrebuiltModuleSource,
} from './prebuilt-module-source'

const RELEASE_ROOT =
  'https://github.com/chfourie/obsidian-bible-study/releases/download'

const CHECKSUMS_FILE = 'checksums.json'

// A module published as a GitHub release: one tag per module, carrying the
// artifact and a checksums file keyed by module id (spec-books §7).
export type PrebuiltRelease = {
  moduleId: string
  tag: string
  filename: string
}

export const releaseArtifactUrl = ({ tag, filename }: PrebuiltRelease): string =>
  `${RELEASE_ROOT}/${tag}/${filename}`

export const releaseChecksumsUrl = ({ tag }: PrebuiltRelease): string =>
  `${RELEASE_ROOT}/${tag}/${CHECKSUMS_FILE}`

export type PrebuiltReleaseArtifact = {
  manifest: Omit<ModuleManifest, 'source' | 'sourceChecksum'>
  books: Record<number, BookContent>
  // Book artifacts only — a translation release carries no epigraphs.
  epigraphs?: ModuleEpigraphs
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

export class PrebuiltReleaseClient implements PrebuiltModuleSource {
  constructor(
    private readonly release: PrebuiltRelease,
    private readonly fetchText: TextTransport = requestUrlTransport,
  ) {}

  async fetchModule(): Promise<PrebuiltModuleDownload> {
    const source = releaseArtifactUrl(this.release)
    const raw = await this.fetchText(source)
    const artifact = JSON.parse(raw) as PrebuiltReleaseArtifact
    const checksum = await sha256Hex(raw)
    const module: NormalizedModule = {
      manifest: { ...artifact.manifest, source, sourceChecksum: checksum },
      books: new Map(
        Object.entries(artifact.books).map(([book, content]) => [
          Number(book),
          content,
        ]),
      ),
      ...(artifact.epigraphs === undefined
        ? {}
        : { epigraphs: artifact.epigraphs }),
    }
    return { module, checksum }
  }

  async fetchChecksum(): Promise<string | null> {
    const raw = await this.fetchText(releaseChecksumsUrl(this.release))
    const checksums = JSON.parse(raw) as Record<string, string>
    return checksums[this.release.moduleId] ?? null
  }
}
