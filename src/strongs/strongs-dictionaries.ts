import type { SettingsStore } from '../data-access'
import {
  MODULE_FORMAT_VERSION,
  type ModuleDataDir,
  type ModuleManifest,
} from '../modules'
import type { LexiconSource } from './lexicon-source'
import { parseLexicon, type StrongsEntry } from './parse-lexicon'

export const STRONGS_DICTIONARIES_ID = 'strongs-dictionaries'

export const STRONGS_ATTRIBUTION =
  'Dictionary data: TBESH/TBESG by www.STEPBible.org, ' +
  'Tyndale House Cambridge (CC BY 4.0)'

const MODULE_DIR = `modules/${STRONGS_DICTIONARIES_ID}`
const MANIFEST_PATH = `${MODULE_DIR}/manifest.json`
const LEXICON_PATH = { H: `${MODULE_DIR}/hebrew.json`, G: `${MODULE_DIR}/greek.json` }

type LexiconKey = keyof typeof LEXICON_PATH

const manifest = (): ModuleManifest => ({
  id: STRONGS_DICTIONARIES_ID,
  name: "Strong's Dictionaries (STEPBible TBESH/TBESG)",
  language: 'English',
  license: STRONGS_ATTRIBUTION,
  source: 'https://github.com/STEPBible/STEPBible-Data',
  sourceChecksum: '',
  formatVersion: MODULE_FORMAT_VERSION,
  kind: 'strongs-dictionaries',
  capabilities: { strongsTagged: false },
})

export class StrongsDictionaries {
  #loaded: Partial<Record<LexiconKey, Record<string, StrongsEntry>>> = {}

  constructor(
    private readonly dataDir: ModuleDataDir,
    private readonly source: LexiconSource,
    private readonly settingsStore: SettingsStore,
  ) {}

  async install(): Promise<void> {
    const [hebrew, greek] = await Promise.all([
      this.source.fetchHebrew(),
      this.source.fetchGreek(),
    ])
    await this.dataDir.removeDir(MODULE_DIR)
    await this.#saveLexicon('H', hebrew)
    await this.#saveLexicon('G', greek)
    await this.dataDir.writeTextFile(
      MANIFEST_PATH,
      JSON.stringify(manifest(), null, 2),
    )
    this.#loaded = {}
    await this.settingsStore.updateSettings((settings) =>
      settings.installedModuleIds.includes(STRONGS_DICTIONARIES_ID)
        ? settings
        : {
            ...settings,
            installedModuleIds: [
              ...settings.installedModuleIds,
              STRONGS_DICTIONARIES_ID,
            ],
          },
    )
  }

  async remove(): Promise<void> {
    await this.dataDir.removeDir(MODULE_DIR)
    this.#loaded = {}
    await this.settingsStore.updateSettings((settings) => ({
      ...settings,
      installedModuleIds: settings.installedModuleIds.filter(
        (id) => id !== STRONGS_DICTIONARIES_ID,
      ),
    }))
  }

  async isInstalled(): Promise<boolean> {
    return (await this.dataDir.readTextFile(MANIFEST_PATH)) !== null
  }

  async entriesFor(numbers: string[]): Promise<StrongsEntry[]> {
    const entries = await Promise.all(
      numbers.map(async (number) => {
        const key = number.charAt(0)
        if (key !== 'H' && key !== 'G') return null
        return (await this.#lexicon(key))[number] ?? null
      }),
    )
    return entries.filter((entry) => entry !== null)
  }

  async #saveLexicon(key: LexiconKey, raw: string): Promise<void> {
    const entries = Object.fromEntries(parseLexicon(raw))
    await this.dataDir.writeTextFile(LEXICON_PATH[key], JSON.stringify(entries))
  }

  async #lexicon(key: LexiconKey): Promise<Record<string, StrongsEntry>> {
    const loaded = this.#loaded[key]
    if (loaded !== undefined) return loaded
    const content = await this.dataDir.readTextFile(LEXICON_PATH[key])
    const parsed =
      content === null
        ? {}
        : (JSON.parse(content) as Record<string, StrongsEntry>)
    this.#loaded[key] = parsed
    return parsed
  }
}
