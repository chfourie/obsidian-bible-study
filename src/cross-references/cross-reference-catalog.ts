import type { Reference } from '../reference'
import type { CrossReference } from './cross-reference-store'

// Everything the reader's editing strip asks of cross-references: the entries
// intersecting what it shows, and the whole-entry changes it commits.
export type CrossReferenceEditing = {
  intersecting: (reference: Reference) => CrossReference[]
  create: (members: Reference[], summary: string | null) => Promise<void>
  update: (
    id: string,
    members: Reference[],
    summary: string | null,
  ) => Promise<void>
  delete: (id: string) => Promise<void>
}

// What a feature needs on top: a change feed, so panes re-read when a
// cross-reference changes elsewhere. While notes and the data-file store
// coexist (ADR 0015), CrossReferencesFeature.catalog is the one place that
// joins them; once the index takes over reading, it satisfies this alone.
export type CrossReferenceCatalog = CrossReferenceEditing & {
  onChanged: (listener: () => void) => () => void
}

// Stands in when a feature runs without a store — a pane that surfaces no
// cross-references and accepts no changes to them.
export const INERT_CROSS_REFERENCE_CATALOG: CrossReferenceCatalog = {
  intersecting: () => [],
  create: async () => {},
  update: async () => {},
  delete: async () => {},
  onChanged: () => () => {},
}
