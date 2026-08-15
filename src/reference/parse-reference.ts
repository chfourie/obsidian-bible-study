import { bookIdForName } from './books'
import { makeVerseId } from './verse-id'
import { verseCount } from './versification'
import { mergeRanges, type Reference, type VerseRange } from './verse-range'

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

const verseIdAt = (
  bookId: number,
  chapter: number,
  verse: number,
): number | null =>
  verse >= 1 && verse <= verseCount(bookId, chapter)
    ? makeVerseId(bookId, chapter, verse)
    : null

const parseWholeChapter = (bookId: number, spec: string): Reference | null => {
  if (!/^\d+$/.test(spec)) return null
  const chapter = Number(spec)
  const lastVerse = verseCount(bookId, chapter)
  if (lastVerse === 0) return null
  return {
    book: bookId,
    ranges: [
      {
        startId: makeVerseId(bookId, chapter, 1),
        endId: makeVerseId(bookId, chapter, lastVerse),
      },
    ],
  }
}

const SEGMENT_PATTERN = /^(?:(\d+):)?(\d+)(?:-(?:(\d+):)?(\d+))?$/

const parseVerseSpec = (bookId: number, spec: string): Reference | null => {
  const wholeChapter = parseWholeChapter(bookId, spec)
  if (wholeChapter) return wholeChapter

  const ranges: VerseRange[] = []
  let currentChapter: number | null = null
  for (const segment of spec.split(',')) {
    const match = SEGMENT_PATTERN.exec(segment)
    if (!match) return null
    const [, startChapter, startVerse, endChapter, endVerse] = match
    const chapter = startChapter ? Number(startChapter) : currentChapter
    if (chapter === null) return null
    const startId = verseIdAt(bookId, chapter, Number(startVerse))
    if (startId === null) return null
    currentChapter = chapter
    let endId = startId
    if (endVerse) {
      const rangeEndChapter = endChapter ? Number(endChapter) : currentChapter
      const id = verseIdAt(bookId, rangeEndChapter, Number(endVerse))
      if (id === null || id < startId) return null
      endId = id
      currentChapter = rangeEndChapter
    }
    ranges.push({ startId, endId })
  }
  if (ranges.length === 0) return null
  return { book: bookId, ranges: mergeRanges(ranges) }
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
