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
