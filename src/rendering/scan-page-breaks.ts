import { bodyLines, frontmatterLength } from '../reference'

export type PageBreak = {
  start: number
  end: number
  lineIndex: number
  trailing: boolean
}

const PAGE_BREAK_MARKER = /^\s*===\s*$/

export const isPageBreakMarker = (text: string): boolean =>
  PAGE_BREAK_MARKER.test(text)

const isBlank = (line: string): boolean => line.trim() === ''

// Frontmatter is not body, so a marker on the body's first line stands at the
// note edge just as one on the last line does.
export const scanPageBreaks = (noteSource: string): PageBreak[] => {
  const lines = noteSource.split('\n')
  const firstBodyLine =
    noteSource.slice(0, frontmatterLength(noteSource)).split('\n').length - 1
  const edgeOrBlank = (index: number): boolean =>
    index < firstBodyLine || index >= lines.length || isBlank(lines[index])
  const nothingAfter = (index: number): boolean =>
    lines.slice(index + 1).every(isBlank)
  return bodyLines(noteSource)
    .filter(
      (line) =>
        isPageBreakMarker(line.text) &&
        edgeOrBlank(line.index - 1) &&
        edgeOrBlank(line.index + 1),
    )
    .map((line) => ({
      start: line.start,
      end: line.start + line.text.length,
      lineIndex: line.index,
      trailing: nothingAfter(line.index),
    }))
}
