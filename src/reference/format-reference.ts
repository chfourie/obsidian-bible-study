import { bookName } from './books'
import { decodeVerseId } from './verse-id'
import { verseCount } from './versification'
import type { Reference, VerseRange } from './verse-range'

const isWholeChapter = (book: number, range: VerseRange): boolean => {
  const start = decodeVerseId(range.startId)
  const end = decodeVerseId(range.endId)
  return (
    start.chapter === end.chapter &&
    start.verse === 1 &&
    end.verse === verseCount(book, start.chapter)
  )
}

const formatRange = (
  range: VerseRange,
  currentChapter: number | null,
): { text: string; chapterAfter: number } => {
  const start = decodeVerseId(range.startId)
  const end = decodeVerseId(range.endId)
  const startText =
    start.chapter === currentChapter
      ? `${start.verse}`
      : `${start.chapter}:${start.verse}`
  if (range.endId === range.startId) {
    return { text: startText, chapterAfter: start.chapter }
  }
  const endText =
    end.chapter === start.chapter
      ? `${end.verse}`
      : `${end.chapter}:${end.verse}`
  return { text: `${startText}-${endText}`, chapterAfter: end.chapter }
}

export const formatReference = (reference: Reference): string => {
  const { book, ranges } = reference
  if (ranges.length === 1 && isWholeChapter(book, ranges[0])) {
    return `${bookName(book)} ${decodeVerseId(ranges[0].startId).chapter}`
  }
  let currentChapter: number | null = null
  const segments: string[] = []
  for (const range of ranges) {
    const { text, chapterAfter } = formatRange(range, currentChapter)
    segments.push(text)
    currentChapter = chapterAfter
  }
  return `${bookName(book)} ${segments.join(',')}`
}
