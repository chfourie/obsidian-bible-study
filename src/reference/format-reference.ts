import { bookName } from './books'
import { decodeVerseId } from './verse-id'
import { firstChapter, lastChapter, verseCount } from './versification'
import type { Reference, VerseRange } from './verse-range'

const wholeChapterSpan = (
  book: number,
  range: VerseRange,
): { from: number; to: number } | null => {
  const start = decodeVerseId(range.startId)
  const end = decodeVerseId(range.endId)
  if (start.verse !== 1) return null
  if (end.verse !== verseCount(book, end.chapter)) return null
  return { from: start.chapter, to: end.chapter }
}

const isWholeBook = (book: number, ranges: readonly VerseRange[]): boolean => {
  if (ranges.length !== 1) return false
  const span = wholeChapterSpan(book, ranges[0])
  return (
    span !== null &&
    span.from === firstChapter(book) &&
    span.to === lastChapter(book)
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

// The address alone, in scripture's numeric family — empty for a whole-book
// reference, which spans no locator at all (spec-books §4).
export const referenceLocator = (reference: Reference): string => {
  const { book, ranges } = reference
  if (isWholeBook(book, ranges)) return ''
  let currentChapter: number | null = null
  const segments: string[] = []
  for (const range of ranges) {
    const span = wholeChapterSpan(book, range)
    if (span) {
      segments.push(
        span.from === span.to ? `${span.from}` : `${span.from}-${span.to}`,
      )
      currentChapter = span.to
      continue
    }
    const { text, chapterAfter } = formatRange(range, currentChapter)
    segments.push(text)
    currentChapter = chapterAfter
  }
  return segments.join(',')
}

export const formatReference = (reference: Reference): string => {
  const name = bookName(reference.book)
  const locator = referenceLocator(reference)
  return locator === '' ? name : `${name} ${locator}`
}
