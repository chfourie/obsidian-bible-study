import type { Reference } from '../reference'

// Everything the reader's editing strip asks of cross-references: the
// whole-note changes it commits. Reading is the vault index's (ADR 0015).
// The handle is the note path.
export type CrossReferenceEditing = {
  create: (members: Reference[], summary: string | null) => Promise<void>
  update: (
    path: string,
    members: Reference[],
    summary: string | null,
  ) => Promise<void>
  delete: (path: string) => Promise<void>
}

// Stands in when a feature runs without cross-reference editing — a pane
// that accepts no changes to them.
export const INERT_CROSS_REFERENCE_EDITING: CrossReferenceEditing = {
  create: async () => {},
  update: async () => {},
  delete: async () => {},
}
