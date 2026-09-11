import { bookIdForName, isNonBiblicalBook } from './books'
import {
  parseCueToken,
  sameExcerptPart,
  sameHighlightCue,
  sameUnderlineCue,
  type CueToken,
  type ExcerptPart,
  type HighlightCue,
  type UnderlineCue,
} from './highlight-cue'
import { makeVerseId } from './verse-id'
import {
  chapterCount,
  firstChapter,
  lastChapter,
  verseCount,
} from './versification'
import { mergeRanges, type Reference, type VerseRange } from './verse-range'

export type DisplayMode = 'inline' | 'block'

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
  highlights: HighlightCue[]
  underlines: UnderlineCue[]
  excerpt: ExcerptPart[]
}

export const matchBook = (
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

const wholeChapterRange = (
  bookId: number,
  chapter: number,
): VerseRange | null => {
  const lastVerse = verseCount(bookId, chapter)
  if (lastVerse === 0) return null
  return {
    startId: makeVerseId(bookId, chapter, 1),
    endId: makeVerseId(bookId, chapter, lastVerse),
  }
}

const wholeChapterSpan = (
  bookId: number,
  from: number,
  to: number,
): VerseRange | null => {
  if (to < from) return null
  const start = wholeChapterRange(bookId, from)
  const end = wholeChapterRange(bookId, to)
  if (!start || !end) return null
  for (let chapter = from; chapter <= to; chapter++) {
    if (verseCount(bookId, chapter) === 0) return null
  }
  return { startId: start.startId, endId: end.endId }
}

const parseWholeChapter = (bookId: number, spec: string): Reference | null => {
  if (!/^\d+$/.test(spec)) return null
  const range = wholeChapterRange(bookId, Number(spec))
  return range ? { book: bookId, ranges: [range] } : null
}

const wholeBookReference = (bookId: number): Reference | null => {
  const range = wholeChapterSpan(
    bookId,
    firstChapter(bookId),
    lastChapter(bookId),
  )
  return range ? { book: bookId, ranges: [range] } : null
}

const SEGMENT_PATTERN = /^(?:(\d+):)?(\d+)(?:-(?:(\d+):)?(\d+))?$/

const parseVerseSpec = (bookId: number, spec: string): Reference | null => {
  const singleChapterBook = chapterCount(bookId) === 1
  if (!singleChapterBook) {
    const wholeChapter = parseWholeChapter(bookId, spec)
    if (wholeChapter) return wholeChapter
  }

  const ranges: VerseRange[] = []
  let currentChapter: number | null = singleChapterBook ? 1 : null
  let chapterMode = !singleChapterBook
  for (const segment of spec.split(',')) {
    const match = SEGMENT_PATTERN.exec(segment)
    if (!match) return null
    const [, startChapter, startVerse, endChapter, endVerse] = match
    const from = Number(startVerse)
    if (!startChapter && chapterMode && !endChapter) {
      const span = endVerse
        ? wholeChapterSpan(bookId, from, Number(endVerse))
        : wholeChapterRange(bookId, from)
      if (!span) return null
      ranges.push(span)
      currentChapter = endVerse ? Number(endVerse) : from
      continue
    }
    const chapter: number | null = startChapter
      ? Number(startChapter)
      : currentChapter
    if (chapter === null) return null
    const startId = verseIdAt(bookId, chapter, from)
    if (startId === null) return null
    currentChapter = chapter
    let endId = startId
    if (endVerse) {
      const rangeEndChapter: number = endChapter
        ? Number(endChapter)
        : currentChapter
      const id = verseIdAt(bookId, rangeEndChapter, Number(endVerse))
      if (id === null || id < startId) return null
      endId = id
      currentChapter = rangeEndChapter
    }
    ranges.push({ startId, endId })
    chapterMode = false
  }
  if (ranges.length === 0) return null
  return { book: bookId, ranges: mergeRanges(ranges) }
}

export type ParseOptions = {
  translationIds?: readonly string[]
}

export const tokenize = (text: string): ReferenceToken[] =>
  [...text.matchAll(/\S+/g)].map((match) => ({
    text: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }))

export const isVerseSpecLike = (text: string): boolean => /^\d[\d:,-]*$/.test(text)

const continuesVerseSpec = (
  spec: string,
  next: { text: string } | undefined,
) =>
  next !== undefined &&
  isVerseSpecLike(next.text) &&
  (spec.endsWith(',') || next.text.startsWith(','))

export const takeVerseSpecTokens = <T extends { text: string }>(
  tokens: readonly T[],
): { spec: string; optionTokens: T[] } | null => {
  if (tokens.length === 0 || !isVerseSpecLike(tokens[0].text)) return null
  let used = 1
  let spec = tokens[0].text
  while (continuesVerseSpec(spec, tokens[used])) {
    spec += tokens[used].text
    used += 1
  }
  return { spec, optionTokens: tokens.slice(used) }
}

export const DISPLAY_MODES: readonly DisplayMode[] = ['inline', 'block']

type ParsedCues = Pick<ParsedReference, 'highlights' | 'underlines' | 'excerpt'>

// Each family keeps its own list; a token repeating one already kept is a
// duplicate in that family alone.
const addCue = (lists: ParsedCues, token: CueToken): boolean => {
  switch (token.family) {
    case 'highlight':
      if (lists.highlights.some((cue) => sameHighlightCue(cue, token.cue)))
        return false
      lists.highlights.push(token.cue)
      return true
    case 'underline':
      if (lists.underlines.some((cue) => sameUnderlineCue(cue, token.cue)))
        return false
      lists.underlines.push(token.cue)
      return true
    case 'excerpt':
      if (lists.excerpt.some((part) => sameExcerptPart(part, token.part)))
        return false
      lists.excerpt.push(token.part)
      return true
  }
}

export const classifyOptionTokens = (
  tokens: ReferenceToken[],
  translationIds: readonly string[],
  reference: Reference,
): Omit<ParsedReference, 'reference'> => {
  let translation: string | null = null
  let display: DisplayMode | null = null
  const invalidTokens: ReferenceToken[] = []
  const cues: ParsedCues = { highlights: [], underlines: [], excerpt: [] }
  // A book has exactly one edition, pinned by its manifest — naming a
  // translation (or the edition code itself) says nothing (spec-books §3).
  const acceptsTranslation = !isNonBiblicalBook(reference.book)
  for (const token of tokens) {
    const lowered = token.text.toLowerCase()
    const displayMode = DISPLAY_MODES.find((mode) => mode === lowered)
    const translationId = acceptsTranslation
      ? translationIds.find((id) => id.toLowerCase() === lowered)
      : undefined
    const cue = parseCueToken(token.text, reference)
    if (displayMode && display === null) {
      display = displayMode
    } else if (translationId !== undefined && translation === null) {
      translation = translationId
    } else if (cue === null || !addCue(cues, cue)) {
      invalidTokens.push(token)
    }
  }
  return { translation, display, invalidTokens, ...cues }
}

export const parseReference = (
  text: string,
  options: ParseOptions = {},
): ParsedReference | null => {
  const tokens = tokenize(text)
  const bookMatch = matchBook(tokens.map((token) => token.text))
  if (!bookMatch) return null
  const rest = tokens.slice(bookMatch.wordsUsed)
  const taken = takeVerseSpecTokens(rest)
  const reference = taken
    ? parseVerseSpec(bookMatch.bookId, taken.spec)
    : rest.length === 0
      ? wholeBookReference(bookMatch.bookId)
      : null
  if (!reference) return null
  return {
    reference,
    ...classifyOptionTokens(
      taken?.optionTokens ?? [],
      options.translationIds ?? [],
      reference,
    ),
  }
}
