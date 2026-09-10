import type { NoteFileVault } from '../../src/notes'

export type FakeNoteFileVault = NoteFileVault & {
  notes: Map<string, string>
  folders: Set<string>
  renames: [string, string][]
  trashed: string[]
}

// An in-memory vault of notes and folders that refuses what Obsidian would:
// creating over a note, or touching one that is not there.
export const fakeNoteFileVault = (
  seed: { notes?: Record<string, string>; folders?: string[] } = {},
): FakeNoteFileVault => {
  const notes = new Map(Object.entries(seed.notes ?? {}))
  const folders = new Set(seed.folders ?? [])
  const renames: [string, string][] = []
  const trashed: string[] = []
  const held = (path: string): string => {
    const content = notes.get(path)
    if (content === undefined) throw new Error(`${path} is not in the vault.`)
    return content
  }
  return {
    notes,
    folders,
    renames,
    trashed,
    exists: (path) => notes.has(path) || folders.has(path),
    ensureFolder: async (path) => {
      folders.add(path)
    },
    createNote: async (path, content) => {
      if (notes.has(path)) throw new Error(`${path} already exists`)
      notes.set(path, content)
    },
    readNote: async (path) => notes.get(path) ?? null,
    modifyNote: async (path, content) => {
      held(path)
      notes.set(path, content)
    },
    renameNote: async (path, newPath) => {
      if (notes.has(newPath)) throw new Error(`${newPath} already exists`)
      notes.set(newPath, held(path))
      notes.delete(path)
      renames.push([path, newPath])
    },
    trashNote: async (path) => {
      held(path)
      notes.delete(path)
      trashed.push(path)
    },
  }
}
