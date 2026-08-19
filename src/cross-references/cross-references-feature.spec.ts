import { describe, expect, it } from 'vitest'
import type { Plugin } from 'obsidian'
import { DEFAULT_SETTINGS } from '../data-access'
import {
  CROSS_REFERENCES_FILE_NAME,
  crossReferencesFilePath,
  LEGACY_CROSS_REFERENCES_FILE_PATH,
  serializeCrossReference,
  type CrossReference,
} from './cross-reference-store'
import type { CrossReferenceVault } from './cross-reference-vault'
import { CrossReferencesFeature } from './cross-references-feature'

const vineCrossReference: CrossReference = {
  id: 'xr-vine',
  members: [
    { book: 43, ranges: [{ startId: 100, endId: 200 }] },
    { book: 19, ranges: [{ startId: 300, endId: 400 }] },
  ],
  description: null,
}

const entryLine = `${serializeCrossReference(vineCrossReference)}\n`

// Two timer turns: one for the debounced follow, one for the adoption chain.
const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  }
}

type VaultHandler = (file: { path: string }) => void

const setup = (files: Record<string, string>, folder = '') => {
  const handlers: Record<string, VaultHandler[]> = {}
  const plugin = {
    app: {
      vault: {
        on: (name: string, handler: VaultHandler) => {
          ;(handlers[name] ??= []).push(handler)
          return {}
        },
      },
    },
    registerEvent: () => {},
  } as unknown as Plugin
  const renames: [string, string][] = []
  const vault: CrossReferenceVault = {
    read: async (path) => files[path] ?? null,
    write: async (path, content) => {
      files[path] = content
    },
    rename: async (from, to) => {
      renames.push([from, to])
      files[to] = files[from]
      delete files[from]
    },
  }
  const feature = new CrossReferencesFeature(plugin, { vault, followDelayMs: 0 })
  feature.useSettings({ ...DEFAULT_SETTINGS, crossReferencesFolder: folder })
  const setFolder = (next: string): void => {
    feature.useSettings({ ...DEFAULT_SETTINGS, crossReferencesFolder: next })
    feature.onSettingsChanged()
  }
  const announce = (event: string, path: string): void => {
    handlers[event]?.forEach((handler) => handler({ path }))
  }
  return { feature, files, renames, setFolder, announce }
}

describe('adopting the configured data file path', () => {
  it('migrates the legacy .jsonl at the vault root to the markdown file', async () => {
    const { feature, files, renames } = setup({
      [LEGACY_CROSS_REFERENCES_FILE_PATH]: entryLine,
    })

    await feature.load()

    expect(renames).toEqual([
      [LEGACY_CROSS_REFERENCES_FILE_PATH, CROSS_REFERENCES_FILE_NAME],
    ])
    expect(files[LEGACY_CROSS_REFERENCES_FILE_PATH]).toBeUndefined()
    expect(files[CROSS_REFERENCES_FILE_NAME]).toBe(entryLine)
    expect(feature.store.all()).toEqual([vineCrossReference])
  })

  it('migrates the legacy file into a configured folder', async () => {
    const { feature, files } = setup(
      { [LEGACY_CROSS_REFERENCES_FILE_PATH]: entryLine },
      'Study/Data',
    )

    await feature.load()

    expect(files[crossReferencesFilePath('Study/Data')]).toBe(entryLine)
    expect(feature.store.all()).toEqual([vineCrossReference])
  })

  it('leaves both files alone when the configured path is already taken', async () => {
    const { feature, files, renames } = setup({
      [LEGACY_CROSS_REFERENCES_FILE_PATH]: entryLine,
      [CROSS_REFERENCES_FILE_NAME]: '',
    })

    await feature.load()

    expect(renames).toEqual([])
    expect(files[LEGACY_CROSS_REFERENCES_FILE_PATH]).toBe(entryLine)
    expect(feature.store.all()).toEqual([])
  })
})

describe('changing the configured folder', () => {
  it('moves the data file and keeps serving its entries', async () => {
    const { feature, files, setFolder } = setup({
      [CROSS_REFERENCES_FILE_NAME]: entryLine,
    })
    await feature.load()

    setFolder('Study/Data')
    await flush()

    expect(files[CROSS_REFERENCES_FILE_NAME]).toBeUndefined()
    expect(files[crossReferencesFilePath('Study/Data')]).toBe(entryLine)
    expect(feature.store.all()).toEqual([vineCrossReference])
  })

  it('ignores settings changes that keep the folder', async () => {
    const { feature, renames, setFolder } = setup({
      [CROSS_REFERENCES_FILE_NAME]: entryLine,
    })
    await feature.load()

    setFolder('')
    await flush()

    expect(renames).toEqual([])
  })

  it('lands on the last of several rapid folder changes', async () => {
    const { feature, files, setFolder } = setup({
      [CROSS_REFERENCES_FILE_NAME]: entryLine,
    })
    await feature.load()

    setFolder('S')
    setFolder('St')
    setFolder('Study')
    await flush()

    expect(files[crossReferencesFilePath('Study')]).toBe(entryLine)
    expect(feature.store.all()).toEqual([vineCrossReference])
  })

  it('watches the moved file for outside edits', async () => {
    const { feature, files, setFolder, announce } = setup({
      [CROSS_REFERENCES_FILE_NAME]: entryLine,
    })
    await feature.load()
    setFolder('Study/Data')
    await flush()

    const path = crossReferencesFilePath('Study/Data')
    files[path] = ''
    announce('modify', path)
    await flush()

    expect(feature.store.all()).toEqual([])
  })
})
