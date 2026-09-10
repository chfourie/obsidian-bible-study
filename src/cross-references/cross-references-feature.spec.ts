import { describe, expect, it } from 'vitest'
import type { Plugin } from 'obsidian'
import { DEFAULT_SETTINGS } from '../data-access'
import { parseReference, type Reference } from '../reference'
import {
  CROSS_REFERENCES_FILE_NAME,
  crossReferencesFilePath,
  LEGACY_CROSS_REFERENCES_FILE_PATH,
  serializeCrossReference,
  type CrossReference,
} from './cross-reference-store'
import type { CrossReferenceNoteVault } from './cross-reference-note-vault'
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

describe('creating a cross-reference note from the strip', () => {
  const ref = (text: string): Reference => {
    const parsed = parseReference(text)
    if (parsed === null) throw new Error(`unparseable reference: ${text}`)
    return parsed.reference
  }

  const vine = [ref('John 15:1-8'), ref('Psalm 80:8-16')]

  const noteHarness = (seedNotes: Record<string, string> = {}) => {
    const notes = new Map(Object.entries(seedNotes))
    const folders = new Set<string>()
    const plugin = {
      app: { vault: { on: () => ({}) } },
      registerEvent: () => {},
    } as unknown as Plugin
    const noteVault: CrossReferenceNoteVault = {
      exists: (path) => notes.has(path) || folders.has(path),
      ensureFolder: async (path) => {
        folders.add(path)
      },
      createNote: async (path, content) => {
        if (notes.has(path)) throw new Error(`${path} already exists`)
        notes.set(path, content)
      },
      readNote: async (path) => notes.get(path) ?? null,
    }
    const dataVault: CrossReferenceVault = {
      read: async () => null,
      write: async () => {},
      rename: async () => {},
    }
    const feature = new CrossReferencesFeature(plugin, {
      vault: dataVault,
      noteVault,
    })
    feature.useSettings({ ...DEFAULT_SETTINGS })
    return { feature, notes, folders }
  }

  it('writes the note with the three keys into the default folder, created on demand', async () => {
    const { feature, notes, folders } = noteHarness()

    await feature.catalog.create(vine, 'Vine imagery')

    expect(folders.has('Cross-References')).toBe(true)
    expect(notes.get('Cross-References/John 15.1-8 + Psalms 80.8-16.md')).toBe(
      '---\ntype: cross-reference\nrefs:\n  - John 15:1-8\n  - Psalms 80:8-16\nsummary: Vine imagery\n---\n\n',
    )
  })

  it('writes into the configured folder', async () => {
    const { feature, notes } = noteHarness()
    feature.useSettings({ ...DEFAULT_SETTINGS, crossReferencesFolder: 'PKM/Cross-References' })

    await feature.catalog.create(vine, null)

    expect(notes.has('PKM/Cross-References/John 15.1-8 + Psalms 80.8-16.md')).toBe(true)
  })

  it('lands notes in the default folder when the persisted folder is the old empty root', async () => {
    const { feature, notes } = noteHarness()
    feature.useSettings({ ...DEFAULT_SETTINGS, crossReferencesFolder: '' })

    await feature.catalog.create(vine, null)

    expect(notes.has('Cross-References/John 15.1-8 + Psalms 80.8-16.md')).toBe(true)
  })

  it('suffixes a second note with the same generated name', async () => {
    const { feature, notes } = noteHarness()

    await feature.catalog.create(vine, 'first')
    await feature.catalog.create(vine, 'second')

    expect(notes.get('Cross-References/John 15.1-8 + Psalms 80.8-16 1.md')).toContain(
      'summary: second',
    )
  })

  it('copies the configured template and overwrites the keys it carries', async () => {
    const { feature, notes } = noteHarness({
      'Templates/Cross-reference.md': '---\ntype: draft\ntags: study\n---\n## Why\n',
    })
    feature.useSettings({
      ...DEFAULT_SETTINGS,
      crossReferenceTemplatePath: 'Templates/Cross-reference.md',
    })

    await feature.catalog.create(vine, 'Vine imagery')

    expect(notes.get('Cross-References/John 15.1-8 + Psalms 80.8-16.md')).toBe(
      '---\ntype: cross-reference\ntags: study\nrefs:\n  - John 15:1-8\n  - Psalms 80:8-16\nsummary: Vine imagery\n---\n## Why\n',
    )
  })

  it('leaves the data file untouched', async () => {
    const { feature } = noteHarness()

    await feature.catalog.create(vine, 'Vine imagery')

    expect(feature.store.all()).toEqual([])
  })
})
