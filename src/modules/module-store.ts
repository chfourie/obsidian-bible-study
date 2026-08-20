import { decodeVerseId } from '../reference'
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

// Inside the module's own directory, so saving over the module or deleting it
// takes its search index along with the content the index was built from.
const searchIndexPath = (moduleId: string): string =>
  `${moduleDir(moduleId)}/search-index.json`

const parseOrNull = <T>(content: string): T | null => {
  try {
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

export class ModuleStore {
  constructor(private readonly dataDir: ModuleDataDir) {}

  async saveModule(module: NormalizedModule): Promise<void> {
    await this.dataDir.removeDir(moduleDir(module.manifest.id))
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

  async readSearchIndex(moduleId: string): Promise<string | null> {
    return this.dataDir.readTextFile(searchIndexPath(moduleId))
  }

  async writeSearchIndex(moduleId: string, content: string): Promise<void> {
    await this.dataDir.writeTextFile(searchIndexPath(moduleId), content)
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

  async manifest(moduleId: string): Promise<ModuleManifest | null> {
    const content = await this.dataDir.readTextFile(manifestPath(moduleId))
    return content === null ? null : parseOrNull<ModuleManifest>(content)
  }

  async deleteModule(moduleId: string): Promise<void> {
    await this.dataDir.removeDir(moduleDir(moduleId))
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
