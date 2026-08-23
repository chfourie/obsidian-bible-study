import { describe, expect, it } from 'vitest'
import { liveDecorationSpecs } from './live-decoration-specs'
import type { RenderContext } from './reference-render-model'

const context: RenderContext = {
  knownTranslationIds: ['web', 'nkjv'],
  defaultTranslationId: 'web',
}

const specsFor = (
  doc: string,
  selections: { from: number; to: number }[] = [],
  visibleRanges: { from: number; to: number }[] = [
    { from: 0, to: doc.length },
  ],
) => liveDecorationSpecs(doc, visibleRanges, selections, context)

describe('liveDecorationSpecs', () => {
  it('decorates each valid reference with its render model', () => {
    const doc = 'Abide: {John 15:4} and {Jhn 15:9 inline}'

    const specs = specsFor(doc)

    expect(specs.map((spec) => [spec.start, spec.end])).toEqual([
      [7, 18],
      [23, 40],
    ])
    expect(specs[0].model.referenceText).toBe('John 15:4')
    expect(specs[1].model.display).toBe('inline')
  })

  it('skips invalid, escaped, and code-span braces', () => {
    const doc = '\\{John 15:4} `{John 15:9}` {"json": true}'

    expect(specsFor(doc)).toEqual([])
  })

  it('keeps only references inside the visible ranges, at document offsets', () => {
    const doc = '{John 15:4}\n{John 15:9}\n{John 15:11}'

    const specs = specsFor(doc, [], [{ from: 12, to: 23 }])

    expect(specs.map((spec) => [spec.start, spec.end])).toEqual([[12, 23]])
    expect(specs[0].model.referenceText).toBe('John 15:9')
  })

  it('scans nothing when no range is visible', () => {
    expect(specsFor('{John 15:4}', [], [])).toEqual([])
  })

  it('honors a code fence opened above the visible range', () => {
    const doc = '```\n{John 15:4}\n```\n'

    expect(specsFor(doc, [], [{ from: 4, to: doc.length }])).toEqual([])
  })

  it('does not mistake a visible-range-initial hr line for frontmatter', () => {
    const doc = 'intro\n---\n{John 15:4}\n---\ntail'

    const specs = specsFor(doc, [], [{ from: 6, to: doc.length }])

    expect(specs.map((spec) => [spec.start, spec.end])).toEqual([[10, 21]])
  })

  it('skips frontmatter even when the visible range starts inside it', () => {
    const doc = '---\nref: {John 15:4}\n---\n{John 15:9}'

    const specs = specsFor(doc, [], [{ from: 4, to: doc.length }])

    expect(specs.map((spec) => spec.model.referenceText)).toEqual(['John 15:9'])
  })

  it('honors an escaping backslash just above the visible range start', () => {
    const doc = 'x \\{John 15:4}'

    expect(specsFor(doc, [], [{ from: 3, to: doc.length }])).toEqual([])
  })

  it('collapses to source when the cursor enters the range', () => {
    const doc = 'Abide: {John 15:4} here'

    expect(specsFor(doc, [{ from: 9, to: 9 }])).toEqual([])
    expect(specsFor(doc, [{ from: 7, to: 7 }])).toEqual([])
    expect(specsFor(doc, [{ from: 18, to: 18 }])).toEqual([])
  })

  it('keeps the decoration when the cursor sits outside the range', () => {
    const doc = 'Abide: {John 15:4} here'

    expect(specsFor(doc, [{ from: 3, to: 3 }])).toHaveLength(1)
    expect(specsFor(doc, [{ from: 20, to: 20 }])).toHaveLength(1)
  })

  it('collapses when a selection spans across the range', () => {
    const doc = 'Abide: {John 15:4} here'

    expect(specsFor(doc, [{ from: 2, to: 21 }])).toEqual([])
  })

  it('labels a relative reference with its typed spec and resolves its tooltip', () => {
    const doc = '{John 15:4-9 web} and {:5 inline}'

    const specs = specsFor(doc)

    expect(specs).toHaveLength(2)
    expect(specs[1].model).toMatchObject({
      relativeSpec: ':5',
      referenceText: 'John 15:5',
      translationId: 'web',
      chipLabel: 'WEB',
      display: 'inline',
    })
    expect(specs[1].model.reference.ranges).toEqual([
      { startId: 43015005, endId: 43015005 },
    ])
  })

  it('gives a relative reference the display mode its spec names', () => {
    const specs = specsFor('{John 15:4-9} {:5 block} {:6}')

    expect(specs.map((spec) => spec.model.display)).toEqual([
      'chip',
      'block',
      'chip',
    ])
  })

  it('overrides the inherited translation with one named on the spec', () => {
    const specs = specsFor('{John 15:4-9 web} and {:5 nkjv}')

    expect(specs[1].model).toMatchObject({
      translationId: 'nkjv',
      chipLabel: 'NKJV',
    })
  })

  it('carries a relative reference\'s cues and invalid tokens', () => {
    const specs = specsFor('{John 15:4-9} {:5 h2/5.0-5.6 bogus}')

    expect(specs[1].model.invalidTokens).toEqual(['bogus'])
    expect(specs[1].model.highlights).toEqual([
      {
        slot: 2,
        startVerseId: 43015005,
        startChar: 0,
        endVerseId: 43015005,
        endChar: 6,
      },
    ])
  })
})
