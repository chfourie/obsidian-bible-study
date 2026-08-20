import type { VerseSegment } from './module-passage-source'

// A stretch of one atom's stored text, as every span channel addresses it:
// character offsets into the text the segments were built from, end-exclusive.
export type TextSpan = { start: number; end: number }

const continuationOf = (segment: VerseSegment): VerseSegment => {
  const { lineStart, lineBreakBefore, ...continued } = segment
  return continued
}

const cutsWithin = (
  spans: readonly TextSpan[],
  offset: number,
  length: number,
): number[] => {
  const cuts = new Set([0, length])
  for (const span of spans) {
    for (const boundary of [span.start - offset, span.end - offset]) {
      if (boundary > 0 && boundary < length) cuts.add(boundary)
    }
  }
  return [...cuts].sort((a, b) => a - b)
}

// Lays one more span channel over segments already built: splits them where
// the spans start and end, and hands each covered piece to `mark` so the
// channel can label it. Line structure stays with the first piece — the rest
// continue the same line.
export const markSpanChannel = <Span extends TextSpan>(
  segments: readonly VerseSegment[],
  spans: readonly Span[],
  mark: (segment: VerseSegment, span: Span) => void,
): VerseSegment[] => {
  if (spans.length === 0) return [...segments]
  const marked: VerseSegment[] = []
  let offset = 0
  for (const segment of segments) {
    const cuts = cutsWithin(spans, offset, segment.text.length)
    for (let index = 0; index < cuts.length - 1; index++) {
      const start = cuts[index]
      const end = cuts[index + 1]
      const span = spans.find(
        (candidate) =>
          candidate.start <= offset + start && offset + end <= candidate.end,
      )
      const piece = index === 0 ? { ...segment } : continuationOf(segment)
      piece.text = segment.text.slice(start, end)
      if (span !== undefined) mark(piece, span)
      marked.push(piece)
    }
    if (segment.text.length === 0) marked.push(segment)
    offset += segment.text.length
  }
  return marked
}
