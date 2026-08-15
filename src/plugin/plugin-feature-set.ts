import type { BibleStudySettings, PluginFeature } from '../data-access'

export class PluginFeatureSet {
  readonly #pluginFeatures: PluginFeature[] = []

  readonly addFeature = (feature: PluginFeature): PluginFeatureSet => {
    this.#pluginFeatures.push(feature)
    return this
  }

  readonly load = async (): Promise<void> => {
    for (const feature of this.#pluginFeatures) {
      try {
        await feature.load()
      } catch (e) {
        console.error(e)
      }
    }
  }

  readonly unload = (): void => {
    this.#pluginFeatures.forEach((feature) => {
      try {
        feature.unload()
      } catch (e) {
        console.error(e)
      }
    })
  }

  readonly useSettings = (settings: BibleStudySettings): void => {
    this.#pluginFeatures.forEach((feature) => {
      try {
        feature.useSettings({ ...settings })
      } catch (e) {
        console.error(e)
      }
    })
  }

  readonly onSettingsChanged = (): void => {
    this.#pluginFeatures.forEach((feature) => {
      try {
        feature.onSettingsChanged()
      } catch (e) {
        console.error(e)
      }
    })
  }
}
