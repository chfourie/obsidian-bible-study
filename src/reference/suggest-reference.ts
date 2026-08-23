import {
  booksMatchingPrefix,
  isNonBiblicalBook,
  registeredBook,
} from './books'
import { DISPLAY_MODES, matchBook, type ParseOptions } from './parse-reference'
import { parseRelativeSpec, takeSpecTokens } from './relative-reference'

export type ReferenceSuggestion = {
  label: string
  insert: string
  replaceFrom: number
}

type Token = { text: string; start: number }

const tokenize = (text: string): Token[] =>
  [...text.matchAll(/\S+/g)].map((match) => ({
    text: match[0],
    start: match.index,
  }))

const isSpecLike = (text: string): boolean => /^\d[\d:,-]*$/.test(text)

const optionSuggestions = (
  optionTokens: Token[],
  current: Token,
  translationIds: readonly string[],
): ReferenceSuggestion[] => {
  const used = optionTokens.map((token) => token.text.toLowerCase())
  const displayUsed = used.some((token) =>
    DISPLAY_MODES.some((mode) => mode === token),
  )
  const translationUsed = translationIds.some((id) =>
    used.includes(id.toLowerCase()),
  )
  const candidates = [
    ...(displayUsed ? [] : DISPLAY_MODES),
    ...(translationUsed ? [] : translationIds),
  ]
  const prefix = current.text.toLowerCase()
  return candidates
    .filter((candidate) => candidate.toLowerCase().startsWith(prefix))
    .map((candidate) => ({
      label: candidate,
      insert: candidate,
      replaceFrom: current.start,
    }))
}

const CHAPTER_PREFIX = /^\d*$/

// A book's sections are typed by number, so completion carries the
// number ↔ name mapping the printed work would show (spec-books §3).
const sectionSuggestions = (
  bookId: number,
  current: Token,
): ReferenceSuggestion[] => {
  const book = registeredBook(bookId)
  if (book === null || !CHAPTER_PREFIX.test(current.text)) return []
  return book.sections
    .filter((section) => `${section.chapter}`.startsWith(current.text))
    .map((section) => ({
      label: `${section.chapter} — ${section.name}`,
      insert: `${section.chapter}:`,
      replaceFrom: current.start,
    }))
}

const bookSuggestions = (
  query: string,
  tokens: Token[],
): ReferenceSuggestion[] =>
  booksMatchingPrefix(query).map((book) => ({
    label: book.name,
    insert: `${book.name} `,
    replaceFrom: tokens[0]?.start ?? query.length,
  }))

const tokensAfterRelativeSpec = (tokens: Token[]): Token[] | null => {
  const taken = takeSpecTokens(tokens)
  if (!taken || !parseRelativeSpec(taken.spec)) return null
  return taken.optionTokens
}

export const suggestReference = (
  query: string,
  options: ParseOptions = {},
): ReferenceSuggestion[] => {
  const endsInGap = query.length === 0 || /\s$/.test(query)
  const tokens = tokenize(query)
  const current: Token = endsInGap
    ? { text: '', start: query.length }
    : tokens[tokens.length - 1]
  const prior = endsInGap ? tokens : tokens.slice(0, -1)
  const afterRelativeSpec = tokensAfterRelativeSpec(prior)
  if (afterRelativeSpec) {
    return optionSuggestions(
      afterRelativeSpec,
      current,
      options.translationIds ?? [],
    )
  }
  const book = matchBook(prior.map((token) => token.text))
  if (book) {
    const afterBook = prior.slice(book.wordsUsed)
    if (afterBook.length === 0) {
      if (current.text === '' || isSpecLike(current.text)) {
        return sectionSuggestions(book.bookId, current)
      }
    } else if (isSpecLike(afterBook[0].text)) {
      return optionSuggestions(
        afterBook.slice(1),
        current,
        isNonBiblicalBook(book.bookId) ? [] : (options.translationIds ?? []),
      )
    }
  }
  return bookSuggestions(query, tokens)
}
