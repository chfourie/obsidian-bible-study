import type { Plugin } from 'obsidian'
import { PluginFeature } from '../data-access'
import {
  crossReferencesFilePath,
  CrossReferenceStore,
  LEGACY_CROSS_REFERENCES_FILE_PATH,
} from './cross-reference-store'
import type { CrossReferenceVault } from './cross-reference-vault'
import { ObsidianCrossReferenceVault } from './obsidian-cross-reference-vault'

const DEFAULT_FOLLOW_DELAY_MS = 800

export type CrossReferencesFeatureOptions = {
  vault?: CrossReferenceVault
  followDelayMs?: number
}

export class CrossReferencesFeature extends PluginFeature {
  readonly store: CrossReferenceStore
  readonly #vault: CrossReferenceVault
  readonly #followDelayMs: number
  #activePath: string | null = null
  #pendingFollow: number | null = null
  #adoptChain: Promise<void> = Promise.resolve()

  constructor(plugin: Plugin, options: CrossReferencesFeatureOptions = {}) {
    super(plugin)
    this.#vault = options.vault ?? new ObsidianCrossReferenceVault(plugin)
    this.#followDelayMs = options.followDelayMs ?? DEFAULT_FOLLOW_DELAY_MS
    this.store = new CrossReferenceStore(this.#vault, {
      filePath: () => this.#configuredPath(),
    })
  }

  override async load(): Promise<void> {
    await this.#adoptConfiguredPath()
    const reloadDataFile = (file: { path: string }): void => {
      if (file.path === this.#activePath) void this.store.load()
    }
    this.plugin.registerEvent(this.plugin.app.vault.on('modify', reloadDataFile))
    this.plugin.registerEvent(this.plugin.app.vault.on('create', reloadDataFile))
    this.plugin.registerEvent(this.plugin.app.vault.on('delete', reloadDataFile))
  }

  // The folder setting persists per keystroke, so following it is debounced
  // to keep half-typed folders from being created, and adoptions are chained
  // so an in-flight move never interleaves with the next one.
  override onSettingsChanged(): void {
    if (this.#activePath === null || this.#configuredPath() === this.#activePath) {
      return
    }
    if (this.#pendingFollow !== null) window.clearTimeout(this.#pendingFollow)
    this.#pendingFollow = window.setTimeout(() => {
      this.#pendingFollow = null
      this.#adoptChain = this.#adoptChain.then(() => this.#adoptConfiguredPath())
    }, this.#followDelayMs)
  }

  override unload(): void {
    if (this.#pendingFollow !== null) window.clearTimeout(this.#pendingFollow)
    this.#pendingFollow = null
  }

  #configuredPath(): string {
    return crossReferencesFilePath(this.settings.crossReferencesFolder)
  }

  // Whichever earlier home still holds a file moves to the configured path,
  // unless that path is already taken — then the file found there wins.
  async #adoptConfiguredPath(): Promise<void> {
    const target = this.#configuredPath()
    const previous = this.#activePath
    this.#activePath = target
    const source = await this.#movableSource(target, previous)
    if (source !== null) await this.#vault.rename(source, target)
    await this.store.load()
  }

  async #movableSource(
    target: string,
    previous: string | null,
  ): Promise<string | null> {
    if ((await this.#vault.read(target)) !== null) return null
    for (const candidate of [previous, LEGACY_CROSS_REFERENCES_FILE_PATH]) {
      if (candidate === null || candidate === target) continue
      if ((await this.#vault.read(candidate)) !== null) return candidate
    }
    return null
  }
}
