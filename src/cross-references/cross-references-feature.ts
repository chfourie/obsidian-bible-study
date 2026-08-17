import type { Plugin } from 'obsidian'
import { PluginFeature } from '../data-access'
import {
  CROSS_REFERENCES_FILE_PATH,
  CrossReferenceStore,
} from './cross-reference-store'
import { ObsidianCrossReferenceVault } from './obsidian-cross-reference-vault'

export class CrossReferencesFeature extends PluginFeature {
  readonly store: CrossReferenceStore

  constructor(plugin: Plugin) {
    super(plugin)
    this.store = new CrossReferenceStore(new ObsidianCrossReferenceVault(plugin))
  }

  override async load(): Promise<void> {
    await this.store.load()
    const reloadDataFile = (file: { path: string }): void => {
      if (file.path === CROSS_REFERENCES_FILE_PATH) void this.store.load()
    }
    this.plugin.registerEvent(this.plugin.app.vault.on('modify', reloadDataFile))
    this.plugin.registerEvent(this.plugin.app.vault.on('create', reloadDataFile))
    this.plugin.registerEvent(this.plugin.app.vault.on('delete', reloadDataFile))
  }
}
