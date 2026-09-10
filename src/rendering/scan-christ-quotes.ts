import { bodyLines, maskInlineCodeSpans, type BodyLine } from '../reference'

export type ChristQuoteMark = '"' | '“'

export const CLOSING_MARK: Record<ChristQuoteMark, string> = {
  '"': '"',
  '“': '”',
}

// A lowercase c starting a word, then an optional escape backslash, then a
// straight or curly opening mark. Matched per line, so ^ is the line start.
// The word boundary is a captured character rather than a lookbehind, which
// older iOS lacks; scanning resumes on the mark so it can bound the next c.
const CHRIST_QUOTE_OPENING = /(^|[\s\p{P}])c(\\?)(["“])/gu

export type ChristQuoteOpening = {
  marker: number
  escaped: boolean
  mark: ChristQuoteMark
}

export const nextChristQuoteOpening = (
  text: string,
  from: number,
): ChristQuoteOpening | null => {
  CHRIST_QUOTE_OPENING.lastIndex = from
  const match = CHRIST_QUOTE_OPENING.exec(text)
  if (!match) return null
  return {
    marker: match.index + match[1].length,
    escaped: match[2] !== '',
    mark: match[3] as ChristQuoteMark,
  }
}

export type ChristQuote = {
  marker: number
  open: number
  close: number
}

export type ChristQuoteCandidate = {
  marker: number
  mark: ChristQuoteMark
  escaped: boolean
  lineIndex: number
  quote: ChristQuote | null
}

const isBlank = (line: BodyLine): boolean => line.text.trim() === ''

const paragraphs = (lines: BodyLine[]): BodyLine[][] => {
  const found: BodyLine[][] = []
  let current: BodyLine[] = []
  let previousIndex = -1
  for (const line of lines) {
    const continues = !isBlank(line) && line.index === previousIndex + 1
    if (!continues && current.length > 0) {
      found.push(current)
      current = []
    }
    if (!isBlank(line)) current.push(line)
    previousIndex = line.index
  }
  if (current.length > 0) found.push(current)
  return found
}

type MaskedLine = { start: number; index: number; text: string }

const closingMarkOffset = (
  lines: MaskedLine[],
  lineAt: number,
  from: number,
  closing: string,
): number | null => {
  for (let i = lineAt; i < lines.length; i++) {
    const at = lines[i].text.indexOf(closing, i === lineAt ? from : 0)
    if (at !== -1) return lines[i].start + at
  }
  return null
}

const scanParagraph = (
  paragraph: BodyLine[],
  found: ChristQuoteCandidate[],
): void => {
  const lines: MaskedLine[] = paragraph.map((line) => ({
    start: line.start,
    index: line.index,
    text: maskInlineCodeSpans(line.text),
  }))
  let lineAt = 0
  let from = 0
  while (lineAt < lines.length) {
    const line = lines[lineAt]
    const opening = nextChristQuoteOpening(line.text, from)
    if (!opening) {
      lineAt++
      from = 0
      continue
    }
    const marker = line.start + opening.marker
    const candidate: ChristQuoteCandidate = {
      marker,
      mark: opening.mark,
      escaped: opening.escaped,
      lineIndex: line.index,
      quote: null,
    }
    found.push(candidate)
    const markAt = opening.marker + (opening.escaped ? 2 : 1)
    from = markAt
    if (candidate.escaped) continue
    const close = closingMarkOffset(
      lines,
      lineAt,
      markAt + 1,
      CLOSING_MARK[opening.mark],
    )
    if (close === null) continue
    candidate.quote = { marker, open: marker + 1, close }
    while (lines[lineAt].start + lines[lineAt].text.length <= close) lineAt++
    from = close - lines[lineAt].start
  }
}

// Every word-start c before a double-quote mark in the note body, escaped or
// not, in source order; the quote is set when a matching closing mark follows
// in the same paragraph. Inline code, fenced code and frontmatter never take
// part.
export const scanChristQuoteCandidates = (
  noteSource: string,
): ChristQuoteCandidate[] => {
  const found: ChristQuoteCandidate[] = []
  if (!noteSource.includes('c')) return found
  for (const paragraph of paragraphs(bodyLines(noteSource))) {
    scanParagraph(paragraph, found)
  }
  return found
}

export const scanChristQuotes = (noteSource: string): ChristQuote[] =>
  scanChristQuoteCandidates(noteSource).flatMap((candidate) =>
    candidate.quote ? [candidate.quote] : [],
  )
