import type { CrossReference } from '../cross-references'
import type { Reference } from '../reference'

// Rendered references open the reader pane through this seam; the reader
// feature provides the implementation when it lands.
export interface ReferenceNavigator {
  openReference(reference: Reference, translationId: string | null): void
  openNote(file: string): void
  // Edits an existing cross-reference: opens the reader at one of its members
  // and loads the editing strip with all of them.
  editCrossReference(entry: CrossReference, translationId: string | null): void
}

export const NOOP_REFERENCE_NAVIGATOR: ReferenceNavigator = {
  openReference: () => {},
  openNote: () => {},
  editCrossReference: () => {},
}
