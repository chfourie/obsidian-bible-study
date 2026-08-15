import { bookIdForName } from './books'
import { makeVerseId } from './verse-id'
import { verseCount } from './versification'
import type { Reference } from './verse-range'

export type DisplayMode = 'inline' | 'callout'

export type ReferenceToken = {
  text: string
  start: number
  end: number
}

export type ParsedReference = {
  reference: Reference
  translation: string | null
  display: DisplayMode | null
  invalidTokens: ReferenceToken[]
}

const matchBook = (
  words: string[],
): { bookId: number; wordsUsed: number } | null => {
  const maxWords = Math.min(words.length, 3)
  for (let wordsUsed = maxWords; wordsUsed >= 1; wordsUsed--) {
    const bookId = bookIdForName(words.slice(0, wordsUsed).join(' '))
    if (bookId !== null) return { bookId, wordsUsed }
  }
  return null
}

const parseVerseSpec = (bookId: number, spec: string): Reference | null => {
  const match = /^(\d+):(\d+)$/.exec(spec)
  if (!match) return null
  const chapter = Number(match[1])
  const verse = Number(match[2])
  if (verse < 1 || verse > verseCount(bookId, chapter)) return null
  const verseId = makeVerseId(bookId, chapter, verse)
  return { book: bookId, ranges: [{ startId: verseId, endId: verseId }] }
}

export const parseReference = (text: string): ParsedReference | null => {
  const words = text.trim().split(/\s+/)
  const bookMatch = matchBook(words)
  if (!bookMatch) return null
  const specWord = words[bookMatch.wordsUsed]
  if (!specWord) return null
  const reference = parseVerseSpec(bookMatch.bookId, specWord)
  if (!reference) return null
  return { reference, translation: null, display: null, invalidTokens: [] }
}
