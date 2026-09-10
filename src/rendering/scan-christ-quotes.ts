import {
  bodyLines,
  isAtxHeading,
  isBlankLine,
  maskInlineCodeSpans,
  type BodyLine,
} from '../reference'

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

// Any indent, not CommonMark's three spaces: Obsidian nests list items
// under a tab by default.
const LIST_ITEM = /^\s*(?:[-*+]|\d{1,9}[.)])(?:\s|$)/

const TABLE_ROW = /^ {0,3}\|/

const BLOCKQUOTE_MARKERS = /^(?: {0,3}>\s?)+/

type LineShape = {
  blank: boolean
  heading: boolean
  listItem: boolean
  tableRow: boolean
  quoteDepth: number
}

const shapeOf = (line: BodyLine): LineShape => {
  const markers = BLOCKQUOTE_MARKERS.exec(line.text)?.[0] ?? ''
  const body = line.text.slice(markers.length)
  return {
    blank: isBlankLine(body),
    heading: isAtxHeading(body),
    listItem: LIST_ITEM.test(body),
    tableRow: TABLE_ROW.test(body),
    quoteDepth: markers.split('>').length - 1,
  }
}

// A heading and a table row are paragraphs of their own; a list item or a
// deeper blockquote opens one; a later line without a marker continues the
// paragraph it follows, as markdown's lazy continuation does.
const startsParagraph = (
  shape: LineShape,
  previous: LineShape | null,
): boolean =>
  previous === null ||
  previous.heading ||
  previous.tableRow ||
  shape.heading ||
  shape.tableRow ||
  shape.listItem ||
  shape.quoteDepth > previous.quoteDepth

type Paragraph = {
  lines: BodyLine[]
  tableRow: boolean
}

const paragraphs = (lines: BodyLine[]): Paragraph[] => {
  const found: Paragraph[] = []
  let current: Paragraph | null = null
  let previousIndex = -1
  let previous: LineShape | null = null
  for (const line of lines) {
    const shape = shapeOf(line)
    if (shape.blank) {
      previous = null
    } else if (
      current === null ||
      line.index !== previousIndex + 1 ||
      startsParagraph(shape, previous)
    ) {
      current = { lines: [line], tableRow: shape.tableRow }
      found.push(current)
    } else {
      current.lines.push(line)
    }
    if (!shape.blank) previous = shape
    previousIndex = line.index
  }
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

const cellEnd = (
  paragraph: Paragraph,
  line: BodyLine,
  from: number,
): number => {
  if (!paragraph.tableRow) return Number.POSITIVE_INFINITY
  const pipe = line.text.indexOf('|', from)
  return pipe === -1 ? Number.POSITIVE_INFINITY : line.start + pipe
}

const scanParagraph = (
  paragraph: Paragraph,
  found: ChristQuoteCandidate[],
): void => {
  const lines = paragraph.lines.map((line) => ({
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
    if (close === null || close > cellEnd(paragraph, line, markAt + 1)) continue
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
