import {
  DEFAULT_BOOK_ATOM_KIND,
  registeredBook,
  type BookAtomKind,
  type RegisteredBook,
} from './books'
import { referenceLocator } from './format-reference'
import { decodeVerseId } from './verse-id'
import { verseCount } from './versification'
import type { Reference, VerseRange } from './verse-range'

// How a book reference presents itself outside the curly-brace grammar
// (spec-books §4): MLA-style locators for the chip, a Chicago-style full
// citation for the block attribution line.
export type BookCitation = {
  title: string
  atom: BookAtomKind
  locator: string
  reference: string
  attribution: string
  editionCode: string
  moduleId: string
}

const chapterLabel = (book: RegisteredBook, chapter: number): string => {
  const section = book.sections.find(
    (candidate) => candidate.chapter === chapter,
  )
  return section?.named === true ? section.name : `ch. ${chapter}`
}

const atomsIn = (range: VerseRange): number =>
  decodeVerseId(range.endId).verse - decodeVerseId(range.startId).verse + 1

const paragraphSpec = (range: VerseRange): string => {
  const start = decodeVerseId(range.startId).verse
  const end = decodeVerseId(range.endId).verse
  return start === end ? `${start}` : `${start}-${end}`
}

const paragraphWord = (count: number): string =>
  count === 1 ? 'par.' : 'pars.'

const wholeChapter = (book: number, range: VerseRange): boolean => {
  const start = decodeVerseId(range.startId)
  const end = decodeVerseId(range.endId)
  return start.verse === 1 && end.verse === verseCount(book, start.chapter)
}

const atomLocator = (
  book: RegisteredBook,
  verseId: number,
): string => {
  const { chapter, verse } = decodeVerseId(verseId)
  return `${chapterLabel(book, chapter)}, par. ${verse}`
}

const paragraphLocator = (
  book: RegisteredBook,
  reference: Reference,
): string => {
  const { ranges } = reference
  const chapters = ranges.flatMap((range) => [
    decodeVerseId(range.startId).chapter,
    decodeVerseId(range.endId).chapter,
  ])
  const first = chapters[0]
  if (chapters.some((chapter) => chapter !== first)) {
    const last = ranges[ranges.length - 1]
    return `${atomLocator(book, ranges[0].startId)} – ${atomLocator(book, last.endId)}`
  }
  const label = chapterLabel(book, first)
  if (ranges.length === 1 && wholeChapter(reference.book, ranges[0])) {
    return label
  }
  const atoms = ranges.reduce((total, range) => total + atomsIn(range), 0)
  const spec = ranges.map(paragraphSpec).join(',')
  return `${label}, ${paragraphWord(atoms)} ${spec}`
}

const atomKind = (book: RegisteredBook): BookAtomKind =>
  book.atom ?? DEFAULT_BOOK_ATOM_KIND

// One locator string per reference, shared by the chip and the full citation
// (spec-books §4). A verse-atom Book reads in scripture's numeric family; a
// whole-book reference of either kind invents no verse span.
const locatorFor = (book: RegisteredBook, reference: Reference): string => {
  const locator = referenceLocator(reference)
  if (locator === '') return ''
  return atomKind(book) === 'verse'
    ? locator
    : paragraphLocator(book, reference)
}

export const bookCitation = (reference: Reference): BookCitation | null => {
  const book = registeredBook(reference.book)
  if (book === null) return null
  const locator = locatorFor(book, reference)
  const cited = `${book.name} (${book.year})`
  return {
    title: book.name,
    atom: atomKind(book),
    locator,
    reference: locator === '' ? book.name : `${book.name} ${locator}`,
    attribution:
      locator === ''
        ? `${book.author}, ${cited}`
        : `${book.author}, ${cited}, ${locator}`,
    editionCode: book.editionCode,
    moduleId: book.moduleId,
  }
}
