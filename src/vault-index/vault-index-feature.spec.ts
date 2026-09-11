import { describe, expect, it } from 'vitest'
import type { Plugin } from 'obsidian'
import { DEFAULT_SETTINGS } from '../data-access'
import { makeVerseId } from '../reference'
import { VaultIndexFeature } from './vault-index-feature'

const plugin = {
  registerEvent: () => {},
  app: {
    vault: { on: () => ({}) },
    metadataCache: { on: () => ({}) },
    workspace: { onLayoutReady: () => {} },
  },
} as unknown as Plugin

const john = {
  book: 43,
  ranges: [{ startId: makeVerseId(43, 15, 4), endId: makeVerseId(43, 15, 4) }],
}

describe('VaultIndexFeature excluded mention folders', () => {
  it('applies the stored folders to the index on load', async () => {
    const feature = new VaultIndexFeature(plugin)
    feature.index.indexNote('Journal/Monday.md', 'see {John 15:4}')
    feature.useSettings({ ...DEFAULT_SETTINGS, mentionExcludedFolders: ['Journal'] })

    await feature.load()

    expect(feature.index.intersectingOccurrences(john)).toEqual([])
  })

  it('applies a changed list to the index', async () => {
    const feature = new VaultIndexFeature(plugin)
    feature.index.indexNote('Journal/Monday.md', 'see {John 15:4}')
    feature.useSettings({ ...DEFAULT_SETTINGS, mentionExcludedFolders: ['Journal'] })
    await feature.load()
    feature.useSettings({ ...DEFAULT_SETTINGS, mentionExcludedFolders: [] })

    feature.onSettingsChanged()

    expect(
      feature.index.intersectingOccurrences(john).map((group) => group.file),
    ).toEqual(['Journal/Monday.md'])
  })
})
