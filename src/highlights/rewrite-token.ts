import {
  formatHighlightCue,
  isHighlightCueToken,
  isNonBiblicalBook,
  matchBook,
  parseReference,
  type HighlightCue,
  type Reference,
} from '../reference'

export type HighlightTokenRewriteOptions = {
  translation?: string | null
  translationIds?: readonly string[]
}

type TextToken = {
  text: string
  start: number
  end: number
}

const tokensOf = (text: string): TextToken[] =>
  [...text.matchAll(/\S+/g)].map((match) => ({
    text: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }))

const withoutCueTokens = (text: string, tokens: readonly TextToken[]): string => {
  let kept = ''
  let cursor = 0
  for (const token of tokens) {
    if (!isHighlightCueToken(token.text)) kept += text.slice(cursor, token.end)
    cursor = token.end
  }
  return kept + text.slice(cursor)
}

const withTranslationAfterSpec = (
  text: string,
  tokens: readonly TextToken[],
  translation: string,
): string => {
  const bookMatch = matchBook(tokens.map((token) => token.text))
  const specToken = bookMatch && tokens[bookMatch.wordsUsed]
  if (!specToken) return text
  return `${text.slice(0, specToken.end)} ${translation}${text.slice(specToken.end)}`
}

const cueTail = (
  cues: readonly HighlightCue[],
  reference: Reference,
): string =>
  [...cues]
    .sort(
      (a, b) =>
        a.startVerseId - b.startVerseId ||
        a.startChar - b.startChar ||
        a.slot - b.slot,
    )
    .map((cue) => formatHighlightCue(cue, reference))
    .join(' ')

export const rewriteHighlightToken = (
  tokenText: string,
  cues: readonly HighlightCue[],
  options: HighlightTokenRewriteOptions = {},
): string => {
  const translationIds = options.translationIds ?? []
  const parsed = parseReference(tokenText, { translationIds })
  if (!parsed) return tokenText

  const tokens = tokensOf(tokenText)
  const body = withoutCueTokens(tokenText, tokens)
  // A cue's offsets index one translation's text, so the first cue pins the
  // translation the reader was looking at. A book has exactly one layer, so
  // there is nothing to pin.
  const pin =
    cues.length > 0 &&
    parsed.translation === null &&
    !isNonBiblicalBook(parsed.reference.book)
      ? options.translation
      : null
  const pinned = pin ? withTranslationAfterSpec(body, tokens, pin) : body
  const tail = cueTail(cues, parsed.reference)
  // Everything outside the cue tail is the user's text, trailing spaces and all.
  return tail === '' ? pinned : `${pinned.trimEnd()} ${tail}`
}
