import { bodyLines, maskInlineCodeSpans, type BodyLine } from '../reference'

export type ChristQuoteMark = '"' | '“'

export const CLOSING_MARK: Record<ChristQuoteMark, string> = {
  '"': '"',
  '“': '”',
}

// The word boundary before the c is a captured character rather than a
// lookbehind, which older iOS lacks; scanning therefore resumes on a closing
// mark, not after it, so that mark can bound the next c.
const CHRIST_QUOTE_OPENING = /(^|[\s\p{P}])c(\\?)(["“])/gu

export type ChristQuoteOpening = {
  prefix: number
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
    prefix: match.index + match[1].length,
    escaped: match[2] !== '',
    mark: match[3] as ChristQuoteMark,
  }
}

export type ChristQuote = {
  prefix: number
  close: number
}

export type ChristQuoteCandidate = {
  prefix: number
  mark: ChristQuoteMark
  escaped: boolean
  lineIndex: number
  close: number | null
}

const ATX_HEADING = /^ {0,3}#{1,6}(\s|$)/

const isBlank = (line: BodyLine): boolean => line.text.trim() === ''

const isHeading = (line: BodyLine): boolean => ATX_HEADING.test(line.text)

const paragraphs = (lines: BodyLine[]): BodyLine[][] => {
  const found: BodyLine[][] = []
  let current: BodyLine[] = []
  let previousIndex = -1
  let previousWasHeading = false
  for (const line of lines) {
    const continues =
      !isBlank(line) &&
      !isHeading(line) &&
      !previousWasHeading &&
      line.index === previousIndex + 1
    if (!continues && current.length > 0) {
      found.push(current)
      current = []
    }
    if (!isBlank(line)) current.push(line)
    previousIndex = line.index
    previousWasHeading = isHeading(line)
  }
  if (current.length > 0) found.push(current)
  return found
}

const closingMarkOffset = (
  lines: BodyLine[],
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
  const lines = paragraph.map((line) => ({
    ...line,
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
    const candidate: ChristQuoteCandidate = {
      prefix: line.start + opening.prefix,
      mark: opening.mark,
      escaped: opening.escaped,
      lineIndex: line.index,
      close: null,
    }
    found.push(candidate)
    const markAt = opening.prefix + (opening.escaped ? 2 : 1)
    from = markAt
    if (candidate.escaped) continue
    const close = closingMarkOffset(
      lines,
      lineAt,
      markAt + 1,
      CLOSING_MARK[opening.mark],
    )
    if (close === null) continue
    candidate.close = close
    while (lines[lineAt].start + lines[lineAt].text.length <= close) lineAt++
    from = close - lines[lineAt].start
  }
}

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
  scanChristQuoteCandidates(noteSource).flatMap(({ prefix, close }) =>
    close === null ? [] : [{ prefix, close }],
  )
