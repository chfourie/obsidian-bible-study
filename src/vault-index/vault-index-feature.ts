import type { Plugin } from 'obsidian'
import { PluginFeature } from '../data-access'
import { ObsidianNoteVault } from './obsidian-note-vault'
import { VaultIndexer } from './vault-indexer'
import { VaultReferenceIndex } from './vault-reference-index'

export class VaultIndexFeature extends PluginFeature {
  readonly index = new VaultReferenceIndex()
  readonly #indexer: VaultIndexer

  constructor(plugin: Plugin) {
    super(plugin)
    this.#indexer = new VaultIndexer(new ObsidianNoteVault(plugin), this.index)
  }

  override async load(): Promise<void> {
    this.#indexer.start()
  }

  override unload(): void {
    this.#indexer.stop()
  }

  // Installing or uninstalling a module changes which references parse, so
  // the whole vault is rescanned (spec-books §6).
  readonly reindexVault = (): Promise<void> => this.#indexer.scanVault()
}
