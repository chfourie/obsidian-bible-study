import type { Plugin } from 'obsidian'
import { PluginFeature, type SettingsStore } from '../data-access'
import { ApiBibleClient } from './api-bible-client'
import { FumsReporter } from './fums-reporter'
import { GetBibleClient } from './getbible-client'
import { ModuleManager } from './module-manager'
import { ModuleStore } from './module-store'
import { ObsidianModuleDataDir } from './obsidian-module-data-dir'
import { PassageCache } from './passage-cache'

const DEVICE_ID_KEY = 'bible-study-fums-device-id'

const persistentDeviceId = (): string => {
  const existing = window.localStorage.getItem(DEVICE_ID_KEY)
  if (existing !== null) return existing
  const deviceId = crypto.randomUUID()
  window.localStorage.setItem(DEVICE_ID_KEY, deviceId)
  return deviceId
}

export class ModulesFeature extends PluginFeature {
  readonly store: ModuleStore
  readonly manager: ModuleManager
  readonly passageCache: PassageCache
  readonly apiBibleClient: ApiBibleClient
  readonly fumsReporter: FumsReporter

  constructor(
    plugin: Plugin,
    readonly settingsStore: SettingsStore,
  ) {
    super(plugin)
    const dataDir = new ObsidianModuleDataDir(plugin)
    this.store = new ModuleStore(dataDir)
    this.manager = new ModuleManager(
      new GetBibleClient(),
      this.store,
      settingsStore,
    )
    this.passageCache = new PassageCache(dataDir)
    this.apiBibleClient = new ApiBibleClient(() => this.settings.apiBibleKey)
    this.fumsReporter = new FumsReporter({
      deviceId: persistentDeviceId(),
      sessionId: crypto.randomUUID(),
    })
  }

  override async load(): Promise<void> {
    await this.passageCache.purgeExpired()
  }
}
