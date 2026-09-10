import { CrossReferencesFeature } from '../../src/cross-references'
import { DEFAULT_SETTINGS } from '../../src/data-access'
import { VaultReferenceIndex } from '../../src/vault-index'
import { fakeNoteFileVault, type FakeNoteFileVault } from './note-file-vault'
import { inertPlugin } from './plugin-stub'

export type CrossReferenceNotesInVault = {
  index: VaultReferenceIndex
  noteVault: FakeNoteFileVault
  feature: CrossReferencesFeature
}

// The real cross-references feature and vault index over an in-memory vault
// of notes, wired as they are live: a rename or trash reaches the index the
// way the vault indexer relays Obsidian's own events.
export const crossReferenceNotesInVault = (
  notes: Record<string, string>,
): CrossReferenceNotesInVault => {
  const index = new VaultReferenceIndex()
  for (const [path, content] of Object.entries(notes)) index.indexNote(path, content)
  const noteVault = fakeNoteFileVault({ notes })
  const relaying: FakeNoteFileVault = {
    ...noteVault,
    renameNote: async (path, newPath) => {
      await noteVault.renameNote(path, newPath)
      index.renameNote(path, newPath)
    },
    trashNote: async (path) => {
      await noteVault.trashNote(path)
      index.removeNote(path)
    },
  }
  const feature = new CrossReferencesFeature(inertPlugin(), {
    vault: { read: async () => null, write: async () => {}, rename: async () => {} },
    noteVault: relaying,
    index,
  })
  feature.useSettings({ ...DEFAULT_SETTINGS })
  return { index, noteVault, feature }
}
