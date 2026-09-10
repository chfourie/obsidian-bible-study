import {
  bodyLines,
  frontmatterLineCount,
  isAtxHeading,
  isBlankLine,
} from '../reference'

export type PageBreak = {
  start: number
  end: number
  trailing: boolean
}

// A line that reading view shows as a paragraph of its own holding only
// ===, as near as a line scan can tell; only some of them are Page Breaks.
export type PageBreakCandidate = PageBreak & {
  lineIndex: number
  pageBreak: boolean
}

// Up to three leading spaces are the tolerated surround; four or more, or a
// tab, make the line an indented code block, which reading view never shows
// as a paragraph.
const PAGE_BREAK_MARKER = /^ {0,3}===\s*$/
const ESCAPED_MARKER = /^ {0,3}\\===\s*$/

const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/

// Holds for the source line as well as for the text reading view renders.
export const isPageBreakMarker = (text: string): boolean =>
  PAGE_BREAK_MARKER.test(text)

// Frontmatter is not body, so a marker on the body's first line stands at the
// note edge just as one on the last line does. An escaped marker and one
// right under a fence close, a heading or a thematic break still render as a
// paragraph of their own, so they count as candidates that are no Page Break;
// a marker under a line of text is its setext underline, one under a table
// row is folded into the table, and one with text on the next line shares a
// paragraph with it.
export const scanPageBreakCandidates = (
  noteSource: string,
): PageBreakCandidate[] => {
  const lines = noteSource.split('\n')
  const firstBodyLine = frontmatterLineCount(noteSource)
  const body = bodyLines(noteSource)
  const bodyIndexes = new Set(body.map((line) => line.index))
  const edgeOrBlank = (index: number): boolean =>
    index < firstBodyLine || index >= lines.length || isBlankLine(lines[index])
  const paragraphEdge = (index: number): boolean =>
    edgeOrBlank(index) || !bodyIndexes.has(index)
  const closesParagraphAbove = (index: number): boolean =>
    paragraphEdge(index) ||
    isAtxHeading(lines[index]) ||
    THEMATIC_BREAK.test(lines[index])
  const nothingAfter = (index: number): boolean =>
    lines.slice(index + 1).every(isBlankLine)
  return body
    .filter(
      (line) =>
        (isPageBreakMarker(line.text) || ESCAPED_MARKER.test(line.text)) &&
        closesParagraphAbove(line.index - 1) &&
        paragraphEdge(line.index + 1),
    )
    .map((line) => ({
      start: line.start,
      end: line.start + line.text.length,
      trailing: nothingAfter(line.index),
      lineIndex: line.index,
      pageBreak:
        isPageBreakMarker(line.text) &&
        edgeOrBlank(line.index - 1) &&
        edgeOrBlank(line.index + 1),
    }))
}

export const scanPageBreaks = (noteSource: string): PageBreak[] =>
  scanPageBreakCandidates(noteSource)
    .filter((candidate) => candidate.pageBreak)
    .map(({ start, end, trailing }) => ({ start, end, trailing }))
