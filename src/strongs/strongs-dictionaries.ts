import type { SettingsStore } from '../data-access'
import {
  MODULE_FORMAT_VERSION,
  ModuleInstallation,
  strongsFamily,
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

const LEXICON_FILE = { H: 'hebrew.json', G: 'greek.json' }

type LexiconKey = keyof typeof LEXICON_FILE

const storedLexicon = (
  raw: string,
  derivations: Map<string, string>,
): string => {
  const { entries, families } = parseLexicon(raw)
  const stored: StoredLexicon = {
    entries: Object.fromEntries(
      [...entries].map(([extendedNumber, entry]) => [
        extendedNumber,
        { ...entry, derivation: derivations.get(entry.family) ?? null },
      ]),
    ),
    families: Object.fromEntries(families),
  }
  return JSON.stringify(stored)
}

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
  readonly #installation: ModuleInstallation

  constructor(
    dataDir: ModuleDataDir,
    private readonly source: LexiconSource,
    settingsStore: SettingsStore,
  ) {
    this.#installation = new ModuleInstallation(
      dataDir,
      settingsStore,
      manifest(),
    )
  }

  async install(): Promise<void> {
    const [hebrew, greek, hebrewDerivations, greekDerivations] =
      await Promise.all([
        this.source.fetchHebrew(),
        this.source.fetchGreek(),
        this.source.fetchHebrewDerivations(),
        this.source.fetchGreekDerivations(),
      ])
    await this.#installation.install(
      new Map([
        [
          LEXICON_FILE.H,
          storedLexicon(hebrew, parseHebrewDerivations(hebrewDerivations)),
        ],
        [
          LEXICON_FILE.G,
          storedLexicon(greek, parseGreekDerivations(greekDerivations)),
        ],
      ]),
    )
  }

  async remove(): Promise<void> {
    await this.#installation.remove()
  }

  async isInstalled(): Promise<boolean> {
    return this.#installation.isInstalled()
  }

  // A module format bump means the stored lexicons predate what the panel now
  // reads — extended-number entries, morphology, derivations. Re-downloading
  // is the only migration, so an outdated install rebuilds itself rather than
  // asking the reader to notice.
  async rebuildIfOutdated(): Promise<void> {
    const installed = await this.#installation.installedManifest()
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
      siblings: (found.lexicon.families[entry.family] ?? []).filter(
        (sibling) => sibling !== entry.extendedNumber,
      ),
      derivation,
    }
  }

  // Who a family-matched count covers where no entry was resolved: the rest of
  // the family, which the index knows even for a number no entry answers to.
  async familySiblingsOf(number: string): Promise<string[]> {
    const key = number.charAt(0)
    if (key !== 'H' && key !== 'G') return []
    const lexicon = await this.#lexicon(key)
    return (lexicon.families[strongsFamily(number)] ?? []).filter(
      (extendedNumber) => extendedNumber !== number,
    )
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
    const extendedNumber = lexicon.families[number]?.[0] ?? number
    const stored = lexicon.entries[extendedNumber]
    if (stored === undefined) return null
    const { derivation, ...entry } = stored
    return { lexicon, entry, derivation }
  }

  async #lexicon(key: LexiconKey): Promise<StoredLexicon> {
    return this.#installation.parsed<StoredLexicon>(
      LEXICON_FILE[key],
      EMPTY_LEXICON,
    )
  }
}
