import type { CrossReference } from '../cross-references'
import type { Reference } from '../reference'

// Words the opened passage emphasizes, addressed as character offsets into
// one atom's stored text in the translation the caller searched. Computed by
// whoever knows the words — the reader never learns the tokenizer.
// Offsets into the atom's stored text, or — with `heading` given — into that
// Heading of the atom, which is emphasized in the reader as its text is.
export type EmphasisSpan = {
  verseId: number
  start: number
  end: number
  heading?: number
}

// Cmd/Ctrl-activated references ask for their own reader pane instead of
// taking over the open one; emphasis rides along with the entry and lives as
// long as its banner does.
export type NavigationOptions = {
  newPane?: boolean
  emphasis?: readonly EmphasisSpan[]
}

// Rendered references open the reader pane through this seam; the reader
// feature provides the implementation when it lands.
export interface ReferenceNavigator {
  openReference(
    reference: Reference,
    translationId: string | null,
    options?: NavigationOptions,
  ): void
  openNote(file: string): void
  // Edits an existing cross-reference: opens the reader at one of its members
  // and loads the editing strip with all of them.
  editCrossReference(
    entry: CrossReference,
    translationId: string | null,
    options?: NavigationOptions,
  ): void
}

export const NOOP_REFERENCE_NAVIGATOR: ReferenceNavigator = {
  openReference: () => {},
  openNote: () => {},
  editCrossReference: () => {},
}
