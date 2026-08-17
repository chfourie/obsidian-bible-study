import type { Reference } from '../reference'

// Rendered references open the reader pane through this seam; the reader
// feature provides the implementation when it lands.
export interface ReferenceNavigator {
  openReference(reference: Reference, translationId: string | null): void
  openNote(file: string): void
  // Grows an existing cross-reference: opens the reader at one of its
  // members and re-enters the collection flow pre-loaded with all of them.
  growCrossReference(
    id: string,
    members: Reference[],
    translationId: string | null,
  ): void
}

export const NOOP_REFERENCE_NAVIGATOR: ReferenceNavigator = {
  openReference: () => {},
  openNote: () => {},
  growCrossReference: () => {},
}
