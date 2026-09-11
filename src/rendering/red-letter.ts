// Reading mode, Live Preview and the passage view all paint words of Christ
// with the same class, so the stylesheet has one rule to keep in step.
export const RED_LETTER_CLASS = 'scripture-study-red-letter'

// An ellipsis inside a Christ Quote is the author's elision, not a word of
// Christ, so it keeps the normal text colour: a run of three or more dots or
// the one-character mark.
export const ELISION_CLASS = 'scripture-study-elision'

const ELISION = /\.{3,}|…/gu

export type ElisionRange = { from: number; to: number }

export const elisionsIn = (
  text: string,
  from: number,
  to: number,
): ElisionRange[] => {
  const found: ElisionRange[] = []
  ELISION.lastIndex = from
  let match: RegExpExecArray | null
  while ((match = ELISION.exec(text)) && match.index + match[0].length <= to) {
    found.push({ from: match.index, to: match.index + match[0].length })
  }
  return found
}
