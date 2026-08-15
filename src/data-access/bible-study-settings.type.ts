// Fields land with the features that need them; the settings ticket on the
// wayfinder map enumerates the v1 surface.
export type BibleStudySettings = {
  installedModuleIds: string[]
}

export const DEFAULT_SETTINGS: BibleStudySettings = {
  installedModuleIds: [],
}
