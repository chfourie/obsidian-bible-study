export type TagSpan = {
  start: number
  end: number
  strongs: string[]
}

export type TaggedVerse = {
  text: string
  tags: TagSpan[]
}

export type VerseContent = string | TaggedVerse

export const isTaggedVerse = (content: VerseContent): content is TaggedVerse =>
  typeof content !== 'string'

export const verseTextOf = (content: VerseContent): string =>
  isTaggedVerse(content) ? content.text : content
