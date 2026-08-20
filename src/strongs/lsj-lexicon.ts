import type { SettingsStore } from '../data-access'
import {
  MODULE_FORMAT_VERSION,
  ModuleInstallation,
  type ModuleDataDir,
  type ModuleManifest,
} from '../modules'
import type { LsjSource } from './lsj-source'
import { parseLsjLexicon } from './parse-lsj'

export const LSJ_LEXICON_ID = 'lsj-lexicon'

export const LSJ_ATTRIBUTION =
  'Full LSJ entries: TFLSJ by www.STEPBible.org, Tyndale House Cambridge ' +
  '(CC BY 4.0), from the Liddell-Scott-Jones lexicon via Perseus'

// LSJ entries run to tens of megabytes together, far more than a word study
// ever reads at once. Numbers are stored a thousand at a time so one lookup
// loads its own shard and no more.
const shardOf = (number: string): string => {
  const digits = number.replace(/\D/g, '')
  return digits.slice(0, -3) || '0'
}

const shardFile = (shard: string): string => `G${shard}.json`

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
  readonly #installation: ModuleInstallation

  constructor(
    dataDir: ModuleDataDir,
    private readonly source: LsjSource,
    settingsStore: SettingsStore,
  ) {
    this.#installation = new ModuleInstallation(
      dataDir,
      settingsStore,
      manifest(),
    )
  }

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
    await this.#installation.install(
      new Map(
        [...shards].map(([shard, entries]) => [
          shardFile(shard),
          JSON.stringify(entries),
        ]),
      ),
    )
  }

  async remove(): Promise<void> {
    await this.#installation.remove()
  }

  async isInstalled(): Promise<boolean> {
    return this.#installation.isInstalled()
  }

  async entryFor(number: string): Promise<string | null> {
    if (!number.startsWith('G')) return null
    const shard = await this.#installation.parsed<Record<string, string>>(
      shardFile(shardOf(number)),
      {},
    )
    return shard[number] ?? null
  }
}
