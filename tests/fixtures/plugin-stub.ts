import type { Plugin } from 'obsidian'

// A plugin whose vault raises no events: for features driven through their
// own seams rather than Obsidian's.
export const inertPlugin = (): Plugin =>
  ({
    app: { vault: { on: () => ({}) } },
    registerEvent: () => {},
  }) as unknown as Plugin
