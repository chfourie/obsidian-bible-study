import { describe, expect, it } from 'vitest'
import { liveDecorationSpecs } from './live-decoration-specs'
import type { RenderContext } from './reference-render-model'

const context: RenderContext = {
  knownTranslationIds: ['web'],
  defaultTranslationId: 'web',
}

describe('liveDecorationSpecs', () => {
  it('decorates each valid reference with its render model', () => {
    const doc = 'Abide: {John 15:4} and {Jhn 15:9 inline}'

    const specs = liveDecorationSpecs(doc, [], context)

    expect(specs.map((spec) => [spec.start, spec.end])).toEqual([
      [7, 18],
      [23, 40],
    ])
    expect(specs[0].model.referenceText).toBe('John 15:4')
    expect(specs[1].model.display).toBe('inline')
  })

  it('skips invalid, escaped, and code-span braces', () => {
    const doc = '\\{John 15:4} `{John 15:9}` {"json": true}'

    expect(liveDecorationSpecs(doc, [], context)).toEqual([])
  })

  it('collapses to source when the cursor enters the range', () => {
    const doc = 'Abide: {John 15:4} here'

    expect(liveDecorationSpecs(doc, [{ from: 9, to: 9 }], context)).toEqual([])
    expect(liveDecorationSpecs(doc, [{ from: 7, to: 7 }], context)).toEqual([])
    expect(liveDecorationSpecs(doc, [{ from: 18, to: 18 }], context)).toEqual(
      [],
    )
  })

  it('keeps the decoration when the cursor sits outside the range', () => {
    const doc = 'Abide: {John 15:4} here'

    expect(
      liveDecorationSpecs(doc, [{ from: 3, to: 3 }], context),
    ).toHaveLength(1)
    expect(
      liveDecorationSpecs(doc, [{ from: 20, to: 20 }], context),
    ).toHaveLength(1)
  })

  it('collapses when a selection spans across the range', () => {
    const doc = 'Abide: {John 15:4} here'

    expect(liveDecorationSpecs(doc, [{ from: 2, to: 21 }], context)).toEqual([])
  })
})
