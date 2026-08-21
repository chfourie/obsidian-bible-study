import type { VerseRange } from '../reference'

export type TagSpan = {
  start: number
  end: number
  strongs: string[]
}

// A live reference the build found inside an atom's stored text: the span of
// the author's own citation plus the ranges it resolves to, pre-normalized
// onto the target book's grid (spec-books §8). Stored prose stays clean —
// the reader parses nothing.
export type RefSpan = {
  start: number
  end: number
  ranges: VerseRange[]
}

// A title printed inside a Book section — a Part title or a sub-section head
// — attached to the paragraph it precedes (CONTEXT.md — Heading). Section
// furniture like an epigraph: it consumes no id and never joins the atom's
// text, so highlight and Ref Span offsets are the same with it as without.
export type HeadingLevel = 'part' | 'section' | 'sub-section'

export type Heading = {
  text: string
  level: HeadingLevel
}

// A picture printed inside a Book section — a diagram, a photograph, a table
// the printed work set as an image (CONTEXT.md — Figure). Section furniture
// like a Heading: it consumes no id, never joins the atom's text, is never
// searched and is never citable. It rides on the paragraph it stands with,
// printing above or below it as the printed work has it. The image travels
// inside the module as a data URI, so an installed Book needs no other file.
export type FigurePlace = 'above' | 'below'

export type Figure = {
  image: string
  alt: string
  caption?: string
  place: FigurePlace
}

// A plain character range into the verse text — the shape shared by the
// red-letter and supplied-word channels so segmentation can compose them
// with Strong's tag spans.
export type FormatSpan = {
  start: number
  end: number
}

// One line within a verse, addressed by its character offset into the verse
// text. Lines are joined with a single space in the flat text. A verse that
// starts mid-line (prose continuing a paragraph) simply has no entry at 0.
export type VerseLine = {
  start: number
  // Poetic indent depth (1 or 2); absent for prose lines.
  indent?: number
  // Starts a new paragraph (prose) or stanza (poetry).
  paragraph?: boolean
  // Psalm superscription line, e.g. "A Psalm of David."
  psalmHeading?: boolean
}

export type StructuredVerse = {
  text: string
  tags?: TagSpan[]
  lines?: VerseLine[]
  red?: FormatSpan[]
  supplied?: FormatSpan[]
  refs?: RefSpan[]
  headings?: Heading[]
  figures?: Figure[]
}

export type TaggedVerse = StructuredVerse & { tags: TagSpan[] }

export type VerseContent = string | StructuredVerse

export const isStructuredVerse = (
  content: VerseContent,
): content is StructuredVerse => typeof content !== 'string'

export const verseTextOf = (content: VerseContent): string =>
  isStructuredVerse(content) ? content.text : content

export const verseTagsOf = (content: VerseContent): TagSpan[] =>
  isStructuredVerse(content) ? (content.tags ?? []) : []

export const verseLinesOf = (content: VerseContent): VerseLine[] =>
  isStructuredVerse(content) ? (content.lines ?? []) : []

export const verseRedLetterOf = (content: VerseContent): FormatSpan[] =>
  isStructuredVerse(content) ? (content.red ?? []) : []

export const verseSuppliedOf = (content: VerseContent): FormatSpan[] =>
  isStructuredVerse(content) ? (content.supplied ?? []) : []

export const verseRefsOf = (content: VerseContent): RefSpan[] =>
  isStructuredVerse(content) ? (content.refs ?? []) : []

export const verseHeadingsOf = (content: VerseContent): Heading[] =>
  isStructuredVerse(content) ? (content.headings ?? []) : []

export const verseFiguresOf = (content: VerseContent): Figure[] =>
  isStructuredVerse(content) ? (content.figures ?? []) : []
