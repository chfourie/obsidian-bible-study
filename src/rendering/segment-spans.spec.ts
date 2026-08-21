import { describe, expect, it } from 'vitest'
import { spanSegments } from './segment-spans'
import type { VerseSegment } from './module-passage-source'

const plain = (text: string): VerseSegment => ({ text, redLetter: false })

describe('spanSegments', () => {
  it('cuts out the stretch of text one span covers', () => {
    const segments = [plain('Faithful in Christ | 1:1')]
    expect(spanSegments(segments, { start: 0, end: 18 })).toEqual([
      plain('Faithful in Christ'),
    ])
    expect(spanSegments(segments, { start: 21, end: 24 })).toEqual([
      plain('1:1'),
    ])
  })

  it('keeps the marks the covered pieces already carry', () => {
    const segments: VerseSegment[] = [
      plain('See '),
      { text: 'John 3:16', redLetter: false, refs: [{ startId: 1, endId: 1 }] },
      plain(' | now'),
    ]
    const cited = spanSegments(segments, { start: 0, end: 13 })
    expect(cited.map((segment) => segment.text)).toEqual(['See ', 'John 3:16'])
    expect(cited[1].refs).toEqual([{ startId: 1, endId: 1 }])
  })

  it('splits a segment that straddles the span’s edge', () => {
    const segments = [plain('World | 2:1')]
    expect(
      spanSegments(segments, { start: 0, end: 5 }).map(
        (segment) => segment.text,
      ),
    ).toEqual(['World'])
  })

  it('cuts nothing out of a span of no width — a blank table cell', () => {
    expect(spanSegments([plain('World | 2:1')], { start: 6, end: 6 })).toEqual(
      [],
    )
  })
})
