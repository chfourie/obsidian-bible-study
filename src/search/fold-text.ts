// One word of stored text, addressed by its character offsets into that very
// text: emphasis and index postings both read the offsets, so nothing ever
// has to tokenize a hit again.
export type TextToken = {
  start: number
  end: number
  folded: string
}

const COMBINING_MARKS = /\p{M}/gu

// The one folding the whole search capability agrees on — the index build,
// the query parser and the matcher all reduce text through this, so what a
// query can find is decided in a single place.
export const foldText = (text: string): string =>
  text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase()

// Marks join the letter they decorate rather than breaking the word, so
// decomposed text tokenizes exactly as its composed form does.
const WORD = /[\p{L}\p{N}\p{M}]+/gu

export const tokenizeText = (text: string): TextToken[] => {
  const tokens: TextToken[] = []
  for (const match of text.matchAll(WORD)) {
    const folded = foldText(match[0])
    if (folded.length === 0) continue
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      folded,
    })
  }
  return tokens
}
