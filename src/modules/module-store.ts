import type { ModuleDataDir } from './module-data-dir'
import type { ModuleManifest } from './module-manifest'
import type { NormalizedModule } from './normalize-getbible-translation'

const MODULES_ROOT = 'modules'

const moduleDir = (moduleId: string): string => `${MODULES_ROOT}/${moduleId}`

const manifestPath = (moduleId: string): string =>
  `${moduleDir(moduleId)}/manifest.json`

export class ModuleStore {
  constructor(private readonly dataDir: ModuleDataDir) {}

  async saveModule(module: NormalizedModule): Promise<void> {
    await this.dataDir.writeTextFile(
      manifestPath(module.manifest.id),
      JSON.stringify(module.manifest, null, 2),
    )
  }

  async manifest(moduleId: string): Promise<ModuleManifest | null> {
    const content = await this.dataDir.readTextFile(manifestPath(moduleId))
    return content === null ? null : (JSON.parse(content) as ModuleManifest)
  }
}
