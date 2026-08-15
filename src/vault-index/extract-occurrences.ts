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

type Fence = { marker: string; length: number }

const FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})/

const fenceAt = (line: string): Fence | null => {
  const match = FENCE_PATTERN.exec(line)
  return match ? { marker: match[1][0], length: match[1].length } : null
}

const closesFence = (line: string, open: Fence): boolean => {
  const fence = fenceAt(line)
  return (
    fence !== null && fence.marker === open.marker && fence.length >= open.length
  )
}

const FRONTMATTER_PATTERN = /^---\n.*?\n(?:---|\.\.\.)(?:\n|$)/s

const frontmatterLength = (content: string): number =>
  FRONTMATTER_PATTERN.exec(content)?.[0].length ?? 0

const FRONTMATTER_REF_PATTERN = /^ref:[ \t]*(.*?)[ \t]*$/m

const unquote = (value: string): string =>
  value.length >= 2 &&
  (value[0] === '"' || value[0] === "'") &&
  value.endsWith(value[0])
    ? value.slice(1, -1)
    : value

const frontmatterRef = (frontmatter: string): string | null => {
  const match = FRONTMATTER_REF_PATTERN.exec(frontmatter)
  if (!match) return null
  const value = unquote(match[1])
  return value === '' ? null : value
}

const annotationOccurrence = (
  frontmatter: string,
): ExtractedOccurrence | null => {
  const ref = frontmatterRef(frontmatter)
  if (ref === null) return null
  const parsed = parseReference(ref)
  if (!parsed) return null
  return {
    position: 0,
    reference: parsed.reference,
    source: 'annotation-frontmatter',
  }
}

export const extractOccurrences = (content: string): ExtractedOccurrence[] => {
  const occurrences: ExtractedOccurrence[] = []
  const frontmatterEnd = frontmatterLength(content)
  const annotation = annotationOccurrence(content.slice(0, frontmatterEnd))
  if (annotation) occurrences.push(annotation)
  if (!content.includes('{')) return occurrences
  let lineStart = frontmatterEnd
  let openFence: Fence | null = null
  for (const line of content.slice(lineStart).split('\n')) {
    if (openFence) {
      if (closesFence(line, openFence)) openFence = null
    } else {
      const fence = fenceAt(line)
      if (fence) openFence = fence
      else scanLine(line, lineStart, occurrences)
    }
    lineStart += line.length + 1
  }
  return occurrences
}
