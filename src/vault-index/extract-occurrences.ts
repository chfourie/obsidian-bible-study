import { parseReference } from '../reference'
import type { Occurrence } from './occurrence'

export type ExtractedOccurrence = Omit<Occurrence, 'file'>

const backtickRunLength = (line: string, index: number): number => {
  let length = 0
  while (line[index + length] === '`') length++
  return length
}

const closingBacktickRunEnd = (
  line: string,
  from: number,
  runLength: number,
): number => {
  let i = from
  while (i < line.length) {
    if (line[i] !== '`') {
      i++
      continue
    }
    const length = backtickRunLength(line, i)
    if (length === runLength) return i + length
    i += length
  }
  return -1
}

const scanLine = (
  line: string,
  lineStart: number,
  occurrences: ExtractedOccurrence[],
): void => {
  let i = 0
  while (i < line.length) {
    const char = line[i]
    if (char === '`') {
      const runLength = backtickRunLength(line, i)
      const spanEnd = closingBacktickRunEnd(line, i + runLength, runLength)
      i = spanEnd === -1 ? i + runLength : spanEnd
      continue
    }
    if (char !== '{' || line[i - 1] === '\\') {
      i++
      continue
    }
    const close = line.indexOf('}', i + 1)
    if (close === -1) return
    const parsed = parseReference(line.slice(i + 1, close))
    if (!parsed) {
      i++
      continue
    }
    occurrences.push({
      position: lineStart + i,
      reference: parsed.reference,
      source: 'body',
    })
    i = close + 1
  }
}

export const extractOccurrences = (
  content: string,
  frontmatterRef: string | null,
): ExtractedOccurrence[] => {
  void frontmatterRef
  const occurrences: ExtractedOccurrence[] = []
  if (!content.includes('{')) return occurrences
  let lineStart = 0
  for (const line of content.split('\n')) {
    scanLine(line, lineStart, occurrences)
    lineStart += line.length + 1
  }
  return occurrences
}
