import {
  parseReference,
  type ParsedReference,
  type ParseOptions,
} from './parse-reference'

export type ReferenceMatch = {
  start: number
  end: number
  parsed: ParsedReference
}

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

export const maskInlineCodeSpans = (line: string): string => {
  let masked = ''
  let i = 0
  while (i < line.length) {
    if (line[i] !== '`') {
      masked += line[i]
      i++
      continue
    }
    const runLength = backtickRunLength(line, i)
    const spanEnd = closingBacktickRunEnd(line, i + runLength, runLength)
    if (spanEnd === -1) {
      masked += line.slice(i, i + runLength)
      i += runLength
      continue
    }
    masked += ' '.repeat(spanEnd - i)
    i = spanEnd
  }
  return masked
}

const scanLine = (
  line: string,
  lineStart: number,
  options: ParseOptions,
  matches: ReferenceMatch[],
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
    const parsed = parseReference(line.slice(i + 1, close), options)
    if (!parsed) {
      i++
      continue
    }
    matches.push({
      start: lineStart + i,
      end: lineStart + close + 1,
      parsed,
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

const FRONTMATTER_PATTERN = /^---\r?\n.*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/s

export const frontmatterLength = (content: string): number =>
  FRONTMATTER_PATTERN.exec(content)?.[0].length ?? 0

export const scanReferenceMatches = (
  content: string,
  options: ParseOptions = {},
): ReferenceMatch[] => {
  const matches: ReferenceMatch[] = []
  if (!content.includes('{')) return matches
  let lineStart = frontmatterLength(content)
  let openFence: Fence | null = null
  for (const rawLine of content.slice(lineStart).split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (openFence) {
      if (closesFence(line, openFence)) openFence = null
    } else {
      const fence = fenceAt(line)
      if (fence) openFence = fence
      else scanLine(line, lineStart, options, matches)
    }
    lineStart += rawLine.length + 1
  }
  return matches
}
