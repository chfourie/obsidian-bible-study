export type TagSpan = {
  start: number
  end: number
  strongs: string[]
}

// One poetic line within a verse, addressed by its character offset into the
// verse text. Ticket #31 will add optional per-line metadata (indent depth,
// paragraph start) to this record without another format break.
export type VerseLine = {
  start: number
}

export type StructuredVerse = {
  text: string
  tags?: TagSpan[]
  lines?: VerseLine[]
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
