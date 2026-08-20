import { decodeVerseId } from '../reference'
import {
  CONCORDANCE_INDEX_VERSION,
  buildConcordanceIndex,
  occurrencesOf,
  type ConcordanceIndex,
  type VerseOccurrences,
} from './concordance-index'
import type { ModuleDataDir } from './module-data-dir'
import type { ModuleManifest } from './module-manifest'
import type {
  BookContent,
  ModuleEpigraphs,
  NormalizedModule,
} from './normalized-module'
import { verseTextOf } from './verse-content'

const MODULES_ROOT = 'modules'

const SAFE_MODULE_ID = /^[A-Za-z0-9_-]+$/

const moduleDir = (moduleId: string): string => {
  if (!SAFE_MODULE_ID.test(moduleId))
    throw new Error(`unsafe module id: ${moduleId}`)
  return `${MODULES_ROOT}/${moduleId}`
}

const manifestPath = (moduleId: string): string =>
  `${moduleDir(moduleId)}/manifest.json`

const bookPath = (moduleId: string, book: number): string =>
  `${moduleDir(moduleId)}/${String(book).padStart(3, '0')}.json`

const epigraphsPath = (moduleId: string): string =>
  `${moduleDir(moduleId)}/epigraphs.json`

const concordancePath = (moduleId: string): string =>
  `${moduleDir(moduleId)}/concordance.json`

const parseOrNull = <T>(content: string): T | null => {
  try {
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

// The index as it sits on disk, stamped with the derivation that built it so a
// plugin that counts differently can rebuild it in place.
type StoredConcordance = { version: number; index: ConcordanceIndex }

// An index written before the stamp existed: readable as it stands — its bare
// verse ids are one occurrence each — but due a rebuild.
const asStored = (parsed: unknown): StoredConcordance =>
  parsed !== null && typeof parsed === 'object' && 'index' in parsed
    ? (parsed as StoredConcordance)
    : { version: 0, index: (parsed ?? {}) as ConcordanceIndex }

export class ModuleStore {
  // The last concordance read, held whole: a word study asks for one family
  // after another out of the same translation.
  #concordance: { moduleId: string; index: ConcordanceIndex } | null = null

  constructor(private readonly dataDir: ModuleDataDir) {}

  async saveModule(module: NormalizedModule): Promise<void> {
    await this.dataDir.removeDir(moduleDir(module.manifest.id))
    if (module.manifest.capabilities.strongsTagged) {
      await this.saveConcordance(
        module.manifest.id,
        module.concordance ?? buildConcordanceIndex(module.books),
      )
    }
    for (const [book, content] of module.books) {
      await this.dataDir.writeTextFile(
        bookPath(module.manifest.id, book),
        JSON.stringify(content),
      )
    }
    if (module.epigraphs !== undefined) {
      await this.dataDir.writeTextFile(
        epigraphsPath(module.manifest.id),
        JSON.stringify(module.epigraphs),
      )
    }
    await this.dataDir.writeTextFile(
      manifestPath(module.manifest.id),
      JSON.stringify(module.manifest, null, 2),
    )
  }

  // Only book modules carry epigraphs; every other module — and any module
  // stored before they existed — simply has none.
  async epigraphs(moduleId: string): Promise<ModuleEpigraphs> {
    const content = await this.dataDir.readTextFile(epigraphsPath(moduleId))
    if (content === null) return {}
    return parseOrNull<ModuleEpigraphs>(content) ?? {}
  }

  async verseText(moduleId: string, verseId: number): Promise<string | null> {
    const { book } = decodeVerseId(verseId)
    const content = (await this.bookContent(moduleId, book))?.[verseId]
    return content === undefined ? null : verseTextOf(content)
  }

  async bookContent(
    moduleId: string,
    book: number,
  ): Promise<BookContent | null> {
    const content = await this.dataDir.readTextFile(bookPath(moduleId, book))
    return content === null ? null : parseOrNull<BookContent>(content)
  }

  // Every verse of one Tagged Translation where a Strong's Family is tagged,
  // in canon order, each with the occurrences that verse holds. Extended
  // numbers answer under their family on both sides: the tagging's and the
  // caller's.
  async occurrences(
    moduleId: string,
    strongsNumber: string,
  ): Promise<VerseOccurrences[]> {
    return occurrencesOf(await this.#concordanceIndex(moduleId), strongsNumber)
  }

  // Which derivation built the stored index, 0 where none is stored at all.
  async concordanceVersion(moduleId: string): Promise<number> {
    const content = await this.dataDir.readTextFile(concordancePath(moduleId))
    if (content === null) return 0
    return asStored(parseOrNull<unknown>(content)).version
  }

  async saveConcordance(
    moduleId: string,
    index: ConcordanceIndex,
  ): Promise<void> {
    const stored: StoredConcordance = {
      version: CONCORDANCE_INDEX_VERSION,
      index,
    }
    await this.dataDir.writeTextFile(
      concordancePath(moduleId),
      JSON.stringify(stored),
    )
    if (this.#concordance?.moduleId === moduleId) this.#concordance = null
  }

  async saveManifest(manifest: ModuleManifest): Promise<void> {
    await this.dataDir.writeTextFile(
      manifestPath(manifest.id),
      JSON.stringify(manifest, null, 2),
    )
  }

  async #concordanceIndex(moduleId: string): Promise<ConcordanceIndex> {
    const held = this.#concordance
    if (held !== null && held.moduleId === moduleId) return held.index
    const content = await this.dataDir.readTextFile(concordancePath(moduleId))
    const index =
      content === null ? {} : asStored(parseOrNull<unknown>(content)).index
    this.#concordance = { moduleId, index }
    return index
  }

  async manifest(moduleId: string): Promise<ModuleManifest | null> {
    const content = await this.dataDir.readTextFile(manifestPath(moduleId))
    return content === null ? null : parseOrNull<ModuleManifest>(content)
  }

  async deleteModule(moduleId: string): Promise<void> {
    await this.dataDir.removeDir(moduleDir(moduleId))
    if (this.#concordance?.moduleId === moduleId) this.#concordance = null
  }

  async installedManifests(): Promise<ModuleManifest[]> {
    const moduleIds = await this.dataDir.listDirs(MODULES_ROOT)
    const manifests = await Promise.all(
      moduleIds
        .filter((moduleId) => SAFE_MODULE_ID.test(moduleId))
        .map((moduleId) => this.manifest(moduleId)),
    )
    return manifests.filter((manifest) => manifest !== null)
  }
}
