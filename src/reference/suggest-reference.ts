import { booksMatchingPrefix } from './books'
import { DISPLAY_MODES, matchBook, type ParseOptions } from './parse-reference'

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

const bookSuggestions = (
  query: string,
  tokens: Token[],
): ReferenceSuggestion[] =>
  booksMatchingPrefix(query).map((book) => ({
    label: book.name,
    insert: `${book.name} `,
    replaceFrom: tokens[0]?.start ?? query.length,
  }))

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
  const book = matchBook(prior.map((token) => token.text))
  if (book) {
    const afterBook = prior.slice(book.wordsUsed)
    if (afterBook.length === 0) {
      if (current.text === '' || isSpecLike(current.text)) return []
    } else if (isSpecLike(afterBook[0].text)) {
      return optionSuggestions(
        afterBook.slice(1),
        current,
        options.translationIds ?? [],
      )
    }
  }
  return bookSuggestions(query, tokens)
}
