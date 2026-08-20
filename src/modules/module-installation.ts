import type { ScriptureStudySettings, SettingsStore } from '../data-access'
import type { ModuleDataDir } from './module-data-dir'
import type { ModuleManifest } from './module-manifest'

const MODULES_ROOT = 'modules'
const MANIFEST_FILE = 'manifest.json'

export const withModuleInstalled = (
  settings: ScriptureStudySettings,
  moduleId: string,
): ScriptureStudySettings =>
  settings.installedModuleIds.includes(moduleId)
    ? settings
    : {
        ...settings,
        installedModuleIds: [...settings.installedModuleIds, moduleId],
      }

export const withModuleRemoved = (
  settings: ScriptureStudySettings,
  moduleId: string,
): ScriptureStudySettings => ({
  ...settings,
  installedModuleIds: settings.installedModuleIds.filter(
    (id) => id !== moduleId,
  ),
})

// What every data module keeps the same way: its own directory of JSON files,
// the manifest that says it is installed, the installed-module list the rest
// of the plugin reads, and whichever of its files have been parsed since. What
// goes in the files is the module's own business.
export class ModuleInstallation {
  readonly #parsed = new Map<string, unknown>()

  constructor(
    private readonly dataDir: ModuleDataDir,
    private readonly settingsStore: SettingsStore,
    private readonly manifest: ModuleManifest,
  ) {}

  // The files are handed over whole rather than written as they are fetched:
  // a download that fails partway leaves the installed module standing.
  async install(files: Map<string, string>): Promise<void> {
    await this.dataDir.removeDir(this.#dir)
    for (const [name, content] of files) {
      await this.dataDir.writeTextFile(this.#pathOf(name), content)
    }
    await this.dataDir.writeTextFile(
      this.#pathOf(MANIFEST_FILE),
      JSON.stringify(this.manifest, null, 2),
    )
    this.#parsed.clear()
    await this.settingsStore.updateSettings((settings) =>
      withModuleInstalled(settings, this.manifest.id),
    )
  }

  async remove(): Promise<void> {
    await this.dataDir.removeDir(this.#dir)
    this.#parsed.clear()
    await this.settingsStore.updateSettings((settings) =>
      withModuleRemoved(settings, this.manifest.id),
    )
  }

  async isInstalled(): Promise<boolean> {
    return (await this.installedManifest()) !== null
  }

  // The manifest as it was stamped at install time, which may predate the one
  // this build would write.
  async installedManifest(): Promise<ModuleManifest | null> {
    const content = await this.dataDir.readTextFile(this.#pathOf(MANIFEST_FILE))
    return content === null ? null : (JSON.parse(content) as ModuleManifest)
  }

  // Held after the first read: a lookup loads the one file it needs and no
  // more, and asks for it again for every number after that.
  async parsed<T>(name: string, empty: T): Promise<T> {
    const held = this.#parsed.get(name)
    if (held !== undefined) return held as T
    const content = await this.dataDir.readTextFile(this.#pathOf(name))
    const parsed = content === null ? empty : (JSON.parse(content) as T)
    this.#parsed.set(name, parsed)
    return parsed
  }

  get #dir(): string {
    return `${MODULES_ROOT}/${this.manifest.id}`
  }

  #pathOf(name: string): string {
    return `${this.#dir}/${name}`
  }
}
