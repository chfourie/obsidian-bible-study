import type { Reference } from '../reference'
import type { CrossReference } from './cross-reference-store'
import type { CrossReferenceCommands } from './cross-reference-management'

// Everything a surfacing model asks of the cross-reference store: the entries
// intersecting what it shows, and the changes it can make to them. Creating
// hands back the new entry, which no surfacing model has a use for.
export type CrossReferenceEditing = CrossReferenceCommands & {
  intersecting: (reference: Reference) => CrossReference[]
  create: (
    members: Reference[],
    description: string | null,
  ) => Promise<unknown>
  update: (
    id: string,
    members: Reference[],
    description: string | null,
  ) => Promise<void>
}

// What a feature needs on top: the store's change feed, so panes re-read it
// when a cross-reference changes elsewhere. CrossReferenceStore satisfies this
// as it stands, so features take the store itself rather than a hand-built
// bundle of delegating adapters over it.
export type CrossReferenceCatalog = CrossReferenceEditing & {
  onChanged: (listener: () => void) => () => void
}

// Stands in when a feature runs without a store — a pane that surfaces no
// cross-references and accepts no changes to them.
export const INERT_CROSS_REFERENCE_CATALOG: CrossReferenceCatalog = {
  intersecting: () => [],
  create: async () => {},
  updateDescription: async () => {},
  update: async () => {},
  removeMember: async () => ({ ok: true }),
  delete: async () => {},
  onChanged: () => () => {},
}
