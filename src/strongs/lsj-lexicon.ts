import type { SettingsStore } from '../data-access'
import {
  MODULE_FORMAT_VERSION,
  type ModuleDataDir,
  type ModuleManifest,
} from '../modules'
import type { LsjSource } from './lsj-source'
import { parseLsjLexicon } from './parse-lsj'

export const LSJ_LEXICON_ID = 'lsj-lexicon'

export const LSJ_ATTRIBUTION =
  'Full LSJ entries: TFLSJ by www.STEPBible.org, Tyndale House Cambridge ' +
  '(CC BY 4.0), from the Liddell-Scott-Jones lexicon via Perseus'

const MODULE_DIR = `modules/${LSJ_LEXICON_ID}`
const MANIFEST_PATH = `${MODULE_DIR}/manifest.json`

// LSJ entries run to tens of megabytes together, far more than a word study
// ever reads at once. Numbers are stored a thousand at a time so one lookup
// loads its own shard and no more.
const shardOf = (number: string): string => {
  const digits = number.replace(/\D/g, '')
  return digits.slice(0, -3) || '0'
}

const shardPath = (shard: string): string => `${MODULE_DIR}/G${shard}.json`

const manifest = (): ModuleManifest => ({
  id: LSJ_LEXICON_ID,
  name: 'LSJ Lexicon (STEPBible TFLSJ)',
  language: 'Greek',
  license: LSJ_ATTRIBUTION,
  source: 'https://github.com/STEPBible/STEPBible-Data',
  sourceChecksum: '',
  formatVersion: MODULE_FORMAT_VERSION,
  kind: 'lsj-lexicon',
  capabilities: { strongsTagged: false },
})

// The optional Greek-only depth layer: one full Liddell-Scott-Jones entry per
// extended Strong's Number. Hebrew has no counterpart to ask for.
export class LsjLexicon {
  readonly #loaded = new Map<string, Record<string, string>>()

  constructor(
    private readonly dataDir: ModuleDataDir,
    private readonly source: LsjSource,
    private readonly settingsStore: SettingsStore,
  ) {}

  async install(): Promise<void> {
    const parts = await this.source.fetchLsj()
    const shards = new Map<string, Record<string, string>>()
    for (const part of parts) {
      for (const [number, entry] of parseLsjLexicon(part)) {
        const shard = shards.get(shardOf(number)) ?? {}
        shard[number] ??= entry
        shards.set(shardOf(number), shard)
      }
    }
    await this.dataDir.removeDir(MODULE_DIR)
    for (const [shard, entries] of shards) {
      await this.dataDir.writeTextFile(shardPath(shard), JSON.stringify(entries))
    }
    await this.dataDir.writeTextFile(
      MANIFEST_PATH,
      JSON.stringify(manifest(), null, 2),
    )
    this.#loaded.clear()
    await this.settingsStore.updateSettings((settings) =>
      settings.installedModuleIds.includes(LSJ_LEXICON_ID)
        ? settings
        : {
            ...settings,
            installedModuleIds: [...settings.installedModuleIds, LSJ_LEXICON_ID],
          },
    )
  }

  async remove(): Promise<void> {
    await this.dataDir.removeDir(MODULE_DIR)
    this.#loaded.clear()
    await this.settingsStore.updateSettings((settings) => ({
      ...settings,
      installedModuleIds: settings.installedModuleIds.filter(
        (id) => id !== LSJ_LEXICON_ID,
      ),
    }))
  }

  async isInstalled(): Promise<boolean> {
    return (await this.dataDir.readTextFile(MANIFEST_PATH)) !== null
  }

  async entryFor(number: string): Promise<string | null> {
    if (!number.startsWith('G')) return null
    return (await this.#shard(shardOf(number)))[number] ?? null
  }

  async #shard(shard: string): Promise<Record<string, string>> {
    const loaded = this.#loaded.get(shard)
    if (loaded !== undefined) return loaded
    const content = await this.dataDir.readTextFile(shardPath(shard))
    const parsed =
      content === null ? {} : (JSON.parse(content) as Record<string, string>)
    this.#loaded.set(shard, parsed)
    return parsed
  }
}
