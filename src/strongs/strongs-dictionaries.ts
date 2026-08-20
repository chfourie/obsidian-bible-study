import type { SettingsStore } from '../data-access'
import {
  MODULE_FORMAT_VERSION,
  type ModuleDataDir,
  type ModuleManifest,
} from '../modules'
import type { LexiconSource } from './lexicon-source'
import { parseGreekDerivations, parseHebrewDerivations } from './parse-derivations'
import { parseLexicon, type StrongsEntry } from './parse-lexicon'

export const STRONGS_DICTIONARIES_ID = 'strongs-dictionaries'

export const STRONGS_ATTRIBUTION =
  'Dictionary data: TBESH/TBESG by www.STEPBible.org, ' +
  'Tyndale House Cambridge (CC BY 4.0)'

// Named only where a derivation is actually on screen. The Hebrew half is
// CC BY 4.0 by the Open Scriptures Hebrew Bible Project; the Greek half is
// the 1890 text itself, which is public domain.
export const STRONGS_ETYMOLOGY_ATTRIBUTION =
  "Etymology: Strong's Exhaustive Concordance (1890, public domain), " +
  'Hebrew via the Open Scriptures Hebrew Bible Project (CC BY 4.0)'

// One entry as the Word Study Panel needs it: the entry itself, the rest of
// its Strong's Family, and the 1890 derivation of the family it belongs to.
export type StrongsStudyEntry = {
  entry: StrongsEntry
  siblings: string[]
  derivation: string | null
}

// The stored lexicon: entries at extended-number granularity, each carrying
// the derivation of its family, and the family index that gathers siblings.
type StoredLexicon = {
  entries: Record<string, StrongsEntry & { derivation: string | null }>
  families: Record<string, string[]>
}

const EMPTY_LEXICON: StoredLexicon = { entries: {}, families: {} }

const MODULE_DIR = `modules/${STRONGS_DICTIONARIES_ID}`
const MANIFEST_PATH = `${MODULE_DIR}/manifest.json`
const LEXICON_PATH = { H: `${MODULE_DIR}/hebrew.json`, G: `${MODULE_DIR}/greek.json` }

type LexiconKey = keyof typeof LEXICON_PATH

const manifest = (): ModuleManifest => ({
  id: STRONGS_DICTIONARIES_ID,
  name: "Strong's Dictionaries (STEPBible TBESH/TBESG)",
  language: 'English',
  license: `${STRONGS_ATTRIBUTION}. ${STRONGS_ETYMOLOGY_ATTRIBUTION}`,
  source: 'https://github.com/STEPBible/STEPBible-Data',
  sourceChecksum: '',
  formatVersion: MODULE_FORMAT_VERSION,
  kind: 'strongs-dictionaries',
  capabilities: { strongsTagged: false },
})

export class StrongsDictionaries {
  #loaded: Partial<Record<LexiconKey, StoredLexicon>> = {}

  constructor(
    private readonly dataDir: ModuleDataDir,
    private readonly source: LexiconSource,
    private readonly settingsStore: SettingsStore,
  ) {}

  async install(): Promise<void> {
    const [hebrew, greek, hebrewDerivations, greekDerivations] =
      await Promise.all([
        this.source.fetchHebrew(),
        this.source.fetchGreek(),
        this.source.fetchHebrewDerivations(),
        this.source.fetchGreekDerivations(),
      ])
    await this.dataDir.removeDir(MODULE_DIR)
    await this.#saveLexicon('H', hebrew, parseHebrewDerivations(hebrewDerivations))
    await this.#saveLexicon('G', greek, parseGreekDerivations(greekDerivations))
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
    return (await this.#manifest()) !== null
  }

  // A module format bump means the stored lexicons predate what the panel now
  // reads — extended-number entries, morphology, derivations. Re-downloading
  // is the only migration, so an outdated install rebuilds itself rather than
  // asking the reader to notice.
  async rebuildIfOutdated(): Promise<void> {
    const installed = await this.#manifest()
    if (installed === null) return
    if (installed.formatVersion >= MODULE_FORMAT_VERSION) return
    await this.install()
  }

  async entriesFor(numbers: string[]): Promise<StrongsEntry[]> {
    const entries = await Promise.all(
      numbers.map(async (number) => (await this.#resolve(number))?.entry ?? null),
    )
    return entries.filter((entry) => entry !== null)
  }

  async studyEntryFor(number: string): Promise<StrongsStudyEntry | null> {
    const found = await this.#resolve(number)
    if (found === null) return null
    const { entry, derivation } = found
    return {
      entry,
      siblings: (found.lexicon.families[entry.strongs] ?? []).filter(
        (sibling) => sibling !== entry.variant,
      ),
      derivation,
    }
  }

  // A tagged translation asks by Strong's Family; the panel's own links ask by
  // extended number. A family answers with the first sub-entry under it.
  async #resolve(number: string): Promise<
    | {
        lexicon: StoredLexicon
        entry: StrongsEntry
        derivation: string | null
      }
    | null
  > {
    const key = number.charAt(0)
    if (key !== 'H' && key !== 'G') return null
    const lexicon = await this.#lexicon(key)
    const variant = lexicon.families[number]?.[0] ?? number
    const stored = lexicon.entries[variant]
    if (stored === undefined) return null
    const { derivation, ...entry } = stored
    return { lexicon, entry, derivation }
  }

  async #manifest(): Promise<ModuleManifest | null> {
    const content = await this.dataDir.readTextFile(MANIFEST_PATH)
    return content === null ? null : (JSON.parse(content) as ModuleManifest)
  }

  async #saveLexicon(
    key: LexiconKey,
    raw: string,
    derivations: Map<string, string>,
  ): Promise<void> {
    const { entries, families } = parseLexicon(raw)
    const stored: StoredLexicon = {
      entries: Object.fromEntries(
        [...entries].map(([variant, entry]) => [
          variant,
          { ...entry, derivation: derivations.get(entry.strongs) ?? null },
        ]),
      ),
      families: Object.fromEntries(families),
    }
    await this.dataDir.writeTextFile(LEXICON_PATH[key], JSON.stringify(stored))
  }

  async #lexicon(key: LexiconKey): Promise<StoredLexicon> {
    const loaded = this.#loaded[key]
    if (loaded !== undefined) return loaded
    const content = await this.dataDir.readTextFile(LEXICON_PATH[key])
    const parsed =
      content === null ? EMPTY_LEXICON : (JSON.parse(content) as StoredLexicon)
    this.#loaded[key] = parsed
    return parsed
  }
}
