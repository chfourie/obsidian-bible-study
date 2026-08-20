import { bookCitation } from './book-citation'
import { formatReference } from './format-reference'
import type { Reference } from './verse-range'

// How a reference names itself wherever it is listed rather than typed: the
// numeric form for scripture, the MLA-style display format for an installed
// book (spec-books §4). An uninstalled book falls back to the numeric form —
// no kind badge either way, the label alone tells them apart.
export const referenceLabel = (reference: Reference): string =>
  bookCitation(reference)?.reference ?? formatReference(reference)
