import { describe, expect, it } from 'vitest'
import type { Plugin } from 'obsidian'
import { DEFAULT_SETTINGS } from '../data-access'
import { ref } from '../../tests/fixtures/reference'
import { fakeNoteFileVault } from '../../tests/fixtures/note-file-vault'
import { inertPlugin } from '../../tests/fixtures/plugin-stub'
import { crossReferenceNote } from '../../tests/fixtures/cross-reference-note'
import type { NoteFileVault } from '../notes'
import { VaultIndexer, VaultReferenceIndex, type NoteVault } from '../vault-index'
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

const inertDataVault: CrossReferenceVault = {
  read: async () => null,
  write: async () => {},
  rename: async () => {},
}

const noteHarness = (seedNotes: Record<string, string> = {}) => {
  const noteVault = fakeNoteFileVault({ notes: seedNotes })
  const indexed: [string, string][] = []
  const indexRenames: [string, string][] = []
  const feature = new CrossReferencesFeature(inertPlugin(), {
    vault: inertDataVault,
    noteVault,
    index: {
      indexNote: (path, content) => indexed.push([path, content]),
      renameNote: (path, newPath) => indexRenames.push([path, newPath]),
    },
  })
  feature.useSettings({ ...DEFAULT_SETTINGS })
  return { feature, noteVault, notes: noteVault.notes, folders: noteVault.folders, indexed, indexRenames }
}

describe('creating a cross-reference note from the strip', () => {
  const vine = [ref('John 15:1-8'), ref('Psalm 80:8-16')]

  it('writes the note with the three keys into the default folder, created on demand', async () => {
    const { feature, notes, folders } = noteHarness()

    await feature.editing.create(vine, 'Vine imagery')

    expect(folders.has('Cross-References')).toBe(true)
    expect(notes.get('Cross-References/John 15.1-8 + Psalms 80.8-16.md')).toBe(
      '---\ntype: cross-reference\nrefs:\n  - John 15:1-8\n  - Psalms 80:8-16\nsummary: Vine imagery\n---\n\n',
    )
  })

  it('writes into the configured folder', async () => {
    const { feature, notes } = noteHarness()
    feature.useSettings({ ...DEFAULT_SETTINGS, crossReferencesFolder: 'PKM/Cross-References' })

    await feature.editing.create(vine, null)

    expect(notes.has('PKM/Cross-References/John 15.1-8 + Psalms 80.8-16.md')).toBe(true)
  })

  it('lands notes in the default folder when the persisted folder is the old empty root', async () => {
    const { feature, notes } = noteHarness()
    feature.useSettings({ ...DEFAULT_SETTINGS, crossReferencesFolder: '' })

    await feature.editing.create(vine, null)

    expect(notes.has('Cross-References/John 15.1-8 + Psalms 80.8-16.md')).toBe(true)
  })

  it('suffixes a second note with the same generated name', async () => {
    const { feature, notes } = noteHarness()

    await feature.editing.create(vine, 'first')
    await feature.editing.create(vine, 'second')

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

    await feature.editing.create(vine, 'Vine imagery')

    expect(notes.get('Cross-References/John 15.1-8 + Psalms 80.8-16.md')).toBe(
      '---\ntype: cross-reference\ntags: study\nrefs:\n  - John 15:1-8\n  - Psalms 80:8-16\nsummary: Vine imagery\n---\n## Why\n',
    )
  })

  it('leaves the data file untouched', async () => {
    const { feature } = noteHarness()

    await feature.editing.create(vine, 'Vine imagery')

    expect(feature.store.all()).toEqual([])
  })

  it('hands the created note to the index at once', async () => {
    const { feature, notes, indexed } = noteHarness()

    await feature.editing.create(vine, 'Vine imagery')

    const path = 'Cross-References/John 15.1-8 + Psalms 80.8-16.md'
    expect(indexed).toEqual([[path, notes.get(path)]])
  })
})

describe('changing a cross-reference note from the strip', () => {
  const vine = [ref('John 15:1-8'), ref('Psalm 80:8-16')]
  const grafted = [ref('John 15:1-8'), ref('Romans 11:17-24')]
  const generated = 'Cross-References/John 15.1-8 + Psalms 80.8-16.md'

  it('rewrites refs and summary only, the rest of the note byte for byte', async () => {
    const { feature, noteVault } = noteHarness({
      'Cross-References/Vine.md':
        '---\ntags: study\ntype: cross-reference\nrefs:\n  - John 15:1-8\n  - Psalm 80:8-16\nsummary: Vine\naliases: [Vine]\n---\n\n## Why\n\nThe vine is Israel.\n',
    })

    await feature.editing.update('Cross-References/Vine.md', grafted, 'Grafted branches')

    expect(noteVault.notes.get('Cross-References/Vine.md')).toBe(
      '---\ntags: study\ntype: cross-reference\nrefs:\n  - John 15:1-8\n  - Romans 11:17-24\nsummary: Grafted branches\naliases: [Vine]\n---\n\n## Why\n\nThe vine is Israel.\n',
    )
  })

  it('keeps a member it could not parse verbatim through the rewrite', async () => {
    const { feature, noteVault } = noteHarness({
      'Cross-References/Vine.md': crossReferenceNote({
        members: ['John 15:1-8', 'Jonh 3:16', 'Psalm 80:8-16'],
        summary: 'Vine',
      }),
    })

    await feature.editing.update('Cross-References/Vine.md', grafted, null)

    expect(noteVault.notes.get('Cross-References/Vine.md')).toBe(
      '---\ntype: cross-reference\nrefs:\n  - John 15:1-8\n  - Jonh 3:16\n  - Romans 11:17-24\nsummary: ""\n---\n',
    )
  })

  it('renames a note still carrying its generated name after a member edit', async () => {
    const { feature, noteVault, indexed, indexRenames } = noteHarness({
      [generated]: crossReferenceNote({ members: ['John 15:1-8', 'Psalm 80:8-16'] }),
    })

    await feature.editing.update(generated, grafted, 'Grafted')

    const renamed = 'Cross-References/John 15.1-8 + Romans 11.17-24.md'
    expect(noteVault.renames).toEqual([[generated, renamed]])
    expect(noteVault.notes.has(generated)).toBe(false)
    expect(noteVault.notes.get(renamed)).toContain('summary: Grafted')
    expect(indexed).toEqual([[generated, noteVault.notes.get(renamed)]])
    expect(indexRenames).toEqual([[generated, renamed]])
  })

  it('renames a note whose generated name counted a member it can no longer parse', async () => {
    const counted = 'Cross-References/John 15.1-8 + Psalms 80.8-16 (+1).md'
    const { feature, noteVault } = noteHarness({
      [counted]: crossReferenceNote({ members: ['John 15:1-8', 'Psalm 80:8-16', 'Humility 1:2'] }),
    })

    await feature.editing.update(counted, grafted, null)

    expect(noteVault.renames).toEqual([
      [counted, 'Cross-References/John 15.1-8 + Romans 11.17-24 (+1).md'],
    ])
  })

  it('leaves a hand-chosen name alone', async () => {
    const { feature, noteVault, indexed, indexRenames } = noteHarness({
      'Cross-References/Vine.md': crossReferenceNote({
        members: ['John 15:1-8', 'Psalm 80:8-16'],
      }),
    })

    await feature.editing.update('Cross-References/Vine.md', grafted, null)

    expect(noteVault.renames).toEqual([])
    expect(indexRenames).toEqual([])
    expect(indexed.map(([path]) => path)).toEqual(['Cross-References/Vine.md'])
  })

  it('judges the generated name by the members in the note at save time', async () => {
    const { feature, noteVault } = noteHarness({
      [generated]: crossReferenceNote({ members: ['John 15:1-8', 'Romans 11:17-24'] }),
    })

    await feature.editing.update(generated, vine, null)

    expect(noteVault.renames).toEqual([])
  })

  it('keeps a summary-only edit where it is', async () => {
    const { feature, noteVault } = noteHarness({
      [generated]: crossReferenceNote({ members: ['John 15:1-8', 'Psalm 80:8-16'] }),
    })

    await feature.editing.update(generated, vine, 'Vine imagery')

    expect(noteVault.renames).toEqual([])
    expect(noteVault.notes.get(generated)).toContain('summary: Vine imagery')
  })

  it('suffixes the new name when a note already holds it', async () => {
    const taken = 'Cross-References/John 15.1-8 + Romans 11.17-24.md'
    const { feature, noteVault } = noteHarness({
      [generated]: crossReferenceNote({ members: ['John 15:1-8', 'Psalm 80:8-16'] }),
      [taken]: 'other',
    })

    await feature.editing.update(generated, grafted, null)

    expect(noteVault.notes.get(taken)).toBe('other')
    expect(noteVault.notes.has('Cross-References/John 15.1-8 + Romans 11.17-24 1.md')).toBe(true)
  })

  it('refuses to update a note that is not in the vault', async () => {
    const { feature, noteVault, indexed } = noteHarness({})

    await expect(feature.editing.update('gone.md', vine, null)).rejects.toThrow(
      'gone.md is not in the vault.',
    )
    expect(noteVault.notes.size).toBe(0)
    expect(indexed).toEqual([])
  })

  it('moves a deleted note to the trash', async () => {
    const { feature, noteVault } = noteHarness({
      'Cross-References/Vine.md': crossReferenceNote({ members: ['John 15:1-8', 'Psalm 80:8-16'] }),
    })

    await feature.editing.delete('Cross-References/Vine.md')

    expect(noteVault.trashed).toEqual(['Cross-References/Vine.md'])
    expect(noteVault.notes.has('Cross-References/Vine.md')).toBe(false)
  })

  it('refuses to delete a note that is not in the vault', async () => {
    const { feature } = noteHarness({})

    await expect(feature.editing.delete('gone.md')).rejects.toThrow(
      'gone.md is not in the vault.',
    )
  })
})

describe('the index while Obsidian reports the edit', () => {
  const grafted = [ref('John 15:1-8'), ref('Romans 11:17-24')]
  const generated = 'Cross-References/John 15.1-8 + Psalms 80.8-16.md'
  const renamed = 'Cross-References/John 15.1-8 + Romans 11.17-24.md'
  const NEVER_MS = 60_000

  // The real indexer over the feature's vault: Obsidian's modify and rename
  // events reach it only once `report()` is called, after the feature's own
  // writes and index calls have all landed — the order the live app sees.
  const vaultReportingLate = (seedNotes: Record<string, string>) => {
    const noteVault = fakeNoteFileVault({ notes: seedNotes })
    const index = new VaultReferenceIndex()
    for (const [path, content] of Object.entries(seedNotes)) index.indexNote(path, content)
    const changed: Array<(path: string) => void> = []
    const renamedListeners: Array<(path: string, oldPath: string) => void> = []
    const pending: Array<() => void> = []
    const vault: NoteVault = {
      markdownFilePaths: () => [...noteVault.notes.keys()],
      readNote: async (path) => {
        const content = noteVault.notes.get(path)
        if (content === undefined) throw new Error(`no note at ${path}`)
        return content
      },
      onLayoutReady: () => {},
      onNoteChanged: (listener) => changed.push(listener),
      onNoteRenamed: (listener) => renamedListeners.push(listener),
      onNoteDeleted: () => {},
    }
    const indexer = new VaultIndexer(vault, index, { debounceMs: NEVER_MS })
    indexer.start()
    const reporting: NoteFileVault = {
      ...noteVault,
      modifyNote: async (path, content) => {
        await noteVault.modifyNote(path, content)
        pending.push(() => changed.forEach((listener) => listener(path)))
      },
      renameNote: async (path, newPath) => {
        await noteVault.renameNote(path, newPath)
        pending.push(() => renamedListeners.forEach((listener) => listener(newPath, path)))
      },
    }
    const feature = new CrossReferencesFeature(inertPlugin(), {
      vault: inertDataVault,
      noteVault: reporting,
      index,
    })
    feature.useSettings({ ...DEFAULT_SETTINGS })
    const rows = () =>
      index
        .intersectingOccurrences(ref('John 15:1'))
        .map((group) => [
          group.file,
          group.crossReference?.members.map((member) => member.ranges[0].startId),
        ])
    const report = (): void => pending.splice(0).forEach((fire) => fire())
    return { feature, rows, report, stop: () => indexer.stop() }
  }

  it('shows the renamed note with its new members before and after the events land', async () => {
    const { feature, rows, report, stop } = vaultReportingLate({
      [generated]: crossReferenceNote({ members: ['John 15:1-8', 'Psalm 80:8-16'] }),
    })
    const graftedIds = grafted.map((member) => member.ranges[0].startId)

    await feature.editing.update(generated, grafted, 'Grafted')
    expect(rows()).toEqual([[renamed, graftedIds]])

    report()
    expect(rows()).toEqual([[renamed, graftedIds]])
    stop()
  })
})
