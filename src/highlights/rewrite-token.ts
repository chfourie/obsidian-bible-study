import {
  formatExcerptPart,
  formatHighlightCue,
  formatUnderlineCue,
  isCueToken,
  isNonBiblicalBook,
  matchBook,
  parseReference,
  type CueRange,
  type ExcerptPart,
  type HighlightCue,
  type Reference,
  type UnderlineCue,
} from '../reference'

export type CueTokenRewriteOptions = {
  translation?: string | null
  translationIds?: readonly string[]
}

// The three cue families of one reference, each list already canonical
// (CONTEXT.md — Highlight Cue): the rewriter orders and formats, it does not
// merge.
export type CueLists = {
  highlights: readonly HighlightCue[]
  underlines: readonly UnderlineCue[]
  excerpt: readonly ExcerptPart[]
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
    if (!isCueToken(token.text)) kept += text.slice(cursor, token.end)
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

const byPlaceThenSlot = (
  a: CueRange & { slot?: number },
  b: CueRange & { slot?: number },
): number =>
  a.startVerseId - b.startVerseId ||
  a.startChar - b.startChar ||
  (a.slot ?? 0) - (b.slot ?? 0)

const familyTail = <Cue extends CueRange>(
  cues: readonly Cue[],
  format: (cue: Cue) => string,
): string[] => [...cues].sort(byPlaceThenSlot).map(format)

const cueTail = (cues: CueLists, reference: Reference): string =>
  [
    ...familyTail(cues.highlights, (cue) => formatHighlightCue(cue, reference)),
    ...familyTail(cues.underlines, (cue) => formatUnderlineCue(cue, reference)),
    ...familyTail(cues.excerpt, (part) => formatExcerptPart(part, reference)),
  ].join(' ')

const hasAnyCue = (cues: CueLists): boolean =>
  cues.highlights.length + cues.underlines.length + cues.excerpt.length > 0

export const rewriteCueTokens = (
  tokenText: string,
  cues: CueLists,
  options: CueTokenRewriteOptions = {},
): string => {
  const translationIds = options.translationIds ?? []
  const parsed = parseReference(tokenText, { translationIds })
  if (!parsed) return tokenText

  const tokens = tokensOf(tokenText)
  const body = withoutCueTokens(tokenText, tokens)
  // A cue's offsets index one translation's text, so the first cue of any
  // family pins the translation the reader was looking at. A book has exactly
  // one layer, so there is nothing to pin.
  const pin =
    hasAnyCue(cues) &&
    parsed.translation === null &&
    !isNonBiblicalBook(parsed.reference.book)
      ? options.translation
      : null
  const pinned = pin ? withTranslationAfterSpec(body, tokens, pin) : body
  const tail = cueTail(cues, parsed.reference)
  // Everything outside the cue tail is the user's text, trailing spaces and all.
  return tail === '' ? pinned : `${pinned.trimEnd()} ${tail}`
}
