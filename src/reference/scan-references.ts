import {
  parseReference,
  type ParsedReference,
  type ParseOptions,
} from './parse-reference'
import { parseRelativeReference } from './relative-reference'

export type ReferenceMatch = {
  start: number
  end: number
  parsed: ParsedReference
  relativeSpec: string | null
}

class AnchoredMatches {
  readonly matches: ReferenceMatch[] = []
  #anchor: ParsedReference | null = null

  constructor(private readonly options: ParseOptions) {}

  tryMatch(text: string, start: number, end: number): boolean {
    const parsed = parseReference(text, this.options)
    if (parsed) {
      this.#anchor = parsed
      this.matches.push({ start, end, parsed, relativeSpec: null })
      return true
    }
    if (this.#anchor === null) return false
    const relative = parseRelativeReference(text, this.#anchor, this.options)
    if (!relative) return false
    this.matches.push({
      start,
      end,
      parsed: relative.parsed,
      relativeSpec: relative.spec,
    })
    return true
  }
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
  matches: AnchoredMatches,
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
    const matched = matches.tryMatch(
      line.slice(i + 1, close),
      lineStart + i,
      lineStart + close + 1,
    )
    i = matched ? close + 1 : i + 1
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

export type BodyLine = {
  text: string
  start: number
  index: number
}

const lineCount = (text: string): number => text.split('\n').length - 1

// The note's lines that can hold a reference: after the frontmatter and
// outside fenced code blocks, each with its document offset and line number.
export const bodyLines = (content: string): BodyLine[] => {
  const lines: BodyLine[] = []
  const frontmatter = content.slice(0, frontmatterLength(content))
  let start = frontmatter.length
  let index = lineCount(frontmatter)
  let openFence: Fence | null = null
  for (const rawLine of content.slice(start).split('\n')) {
    const text = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (openFence) {
      if (closesFence(text, openFence)) openFence = null
    } else {
      const fence = fenceAt(text)
      if (fence) openFence = fence
      else lines.push({ text, start, index })
    }
    start += rawLine.length + 1
    index++
  }
  return lines
}

export const scanReferenceMatches = (
  content: string,
  options: ParseOptions = {},
): ReferenceMatch[] => {
  const matches = new AnchoredMatches(options)
  if (!content.includes('{')) return matches.matches
  for (const line of bodyLines(content)) {
    scanLine(line.text, line.start, matches)
  }
  return matches.matches
}
