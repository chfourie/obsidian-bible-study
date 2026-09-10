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
// of notes. The vault fires no events here, so whatever the index knows it
// learnt from the feature alone.
export const crossReferenceNotesInVault = (
  notes: Record<string, string>,
): CrossReferenceNotesInVault => {
  const index = new VaultReferenceIndex()
  for (const [path, content] of Object.entries(notes)) index.indexNote(path, content)
  const noteVault = fakeNoteFileVault({ notes })
  const feature = new CrossReferencesFeature(inertPlugin(), { noteVault, index })
  feature.useSettings({ ...DEFAULT_SETTINGS })
  return { index, noteVault, feature }
}
