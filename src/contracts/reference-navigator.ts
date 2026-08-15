import type { Reference } from '../reference'

// Rendered references open the reader pane through this seam; the reader
// feature provides the implementation when it lands.
export interface ReferenceNavigator {
  openReference(reference: Reference, translationId: string | null): void
}

export const NOOP_REFERENCE_NAVIGATOR: ReferenceNavigator = {
  openReference: () => {},
}
