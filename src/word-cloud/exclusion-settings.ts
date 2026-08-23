import type { ScriptureStudySettings } from '../data-access'
import { paddedFamily } from './chapter-word-cloud'

// Adds a family to the user's Cloud Exclusions, once, in the padded form the
// tagged texts use.
export const withWordCloudExclusion =
  (family: string) =>
  (settings: ScriptureStudySettings): ScriptureStudySettings => {
    const padded = paddedFamily(family)
    return settings.wordCloudExclusions.includes(padded)
      ? settings
      : {
          ...settings,
          wordCloudExclusions: [...settings.wordCloudExclusions, padded],
        }
  }
