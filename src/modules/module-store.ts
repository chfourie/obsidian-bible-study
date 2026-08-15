import { decodeVerseId } from '../reference'
import type { ModuleDataDir } from './module-data-dir'
import type { ModuleManifest } from './module-manifest'
import type {
  BookContent,
  NormalizedModule,
} from './normalize-getbible-translation'

const MODULES_ROOT = 'modules'

const moduleDir = (moduleId: string): string => `${MODULES_ROOT}/${moduleId}`

const manifestPath = (moduleId: string): string =>
  `${moduleDir(moduleId)}/manifest.json`

const bookPath = (moduleId: string, book: number): string =>
  `${moduleDir(moduleId)}/${String(book).padStart(3, '0')}.json`

export class ModuleStore {
  constructor(private readonly dataDir: ModuleDataDir) {}

  async saveModule(module: NormalizedModule): Promise<void> {
    await this.dataDir.writeTextFile(
      manifestPath(module.manifest.id),
      JSON.stringify(module.manifest, null, 2),
    )
    for (const [book, content] of module.books) {
      await this.dataDir.writeTextFile(
        bookPath(module.manifest.id, book),
        JSON.stringify(content),
      )
    }
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
}
