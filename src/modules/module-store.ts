import { decodeVerseId } from '../reference'
import type { ModuleDataDir } from './module-data-dir'
import type { ModuleManifest } from './module-manifest'
import type {
  BookContent,
  NormalizedModule,
} from './normalize-getbible-translation'

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
    await this.dataDir.writeTextFile(
      manifestPath(module.manifest.id),
      JSON.stringify(module.manifest, null, 2),
    )
  }

  async verseText(moduleId: string, verseId: number): Promise<string | null> {
    const { book } = decodeVerseId(verseId)
    const content = await this.dataDir.readTextFile(bookPath(moduleId, book))
    if (content === null) return null
    return (JSON.parse(content) as BookContent)[verseId] ?? null
  }

  async manifest(moduleId: string): Promise<ModuleManifest | null> {
    const content = await this.dataDir.readTextFile(manifestPath(moduleId))
    return content === null ? null : (JSON.parse(content) as ModuleManifest)
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
