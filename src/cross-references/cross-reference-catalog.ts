import type { Reference } from '../reference'
import type { CrossReference, MemberRemoval } from './cross-reference-store'

// Everything a surfacing feature asks of the cross-reference store.
// CrossReferenceStore satisfies this as it stands, so features take the store
// itself rather than a hand-built bundle of delegating adapters over it.
export type CrossReferenceCatalog = {
  intersecting: (reference: Reference) => CrossReference[]
  create: (
    members: Reference[],
    description: string | null,
  ) => Promise<CrossReference>
  updateDescription: (id: string, description: string | null) => Promise<void>
  updateMembers: (id: string, members: Reference[]) => Promise<void>
  removeMember: (id: string, memberIndex: number) => Promise<MemberRemoval>
  delete: (id: string) => Promise<void>
  onChanged: (listener: () => void) => () => void
}

// Stands in when a feature runs without a store — a pane that surfaces no
// cross-references and accepts no changes to them.
export const INERT_CROSS_REFERENCE_CATALOG: CrossReferenceCatalog = {
  intersecting: () => [],
  create: async (members, description) => ({ id: '', members, description }),
  updateDescription: async () => {},
  updateMembers: async () => {},
  removeMember: async () => ({ ok: true }),
  delete: async () => {},
  onChanged: () => () => {},
}
