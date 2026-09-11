import { describe, expect, it } from 'vitest'
import {
  liveDecorationSpecs,
  type ChristQuoteDecorationSpec,
  type DocRange,
  type LiveDecorationSpec,
  type PageBreakDecorationSpec,
} from './live-decoration-specs'
import type { RenderContext } from './reference-render-model'

const context: RenderContext = {
  knownTranslationIds: ['web', 'nkjv'],
  defaultTranslationId: 'web',
  pageBreaks: true,
}

const allSpecsFor = (
  doc: string,
  selections: DocRange[] = [],
  visibleRanges: DocRange[] = [{ from: 0, to: doc.length }],
) => liveDecorationSpecs(doc, visibleRanges, selections, context)

const ofKind =
  <Kind extends LiveDecorationSpec['kind']>(kind: Kind) =>
  (
    doc: string,
    selections: DocRange[] = [],
    visibleRanges: DocRange[] = [{ from: 0, to: doc.length }],
  ): Extract<LiveDecorationSpec, { kind: Kind }>[] =>
    allSpecsFor(doc, selections, visibleRanges).filter(
      (spec): spec is Extract<LiveDecorationSpec, { kind: Kind }> =>
        spec.kind === kind,
    )

const specsFor = ofKind('reference')

const quotesFor = ofKind('christ-quote')

const pageBreaksFor = ofKind('page-break')

describe('liveDecorationSpecs', () => {
  it('decorates each valid reference with its render model', () => {
    const doc = 'Abide: {John 15:4} and {Jhn 15:9 inline}'

    const specs = specsFor(doc)

    expect(specs.map((spec) => [spec.kind, spec.start, spec.end])).toEqual([
      ['reference', 7, 18],
      ['reference', 23, 40],
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

  it('does not mistake a `---` line at the visible-range start for frontmatter', () => {
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

  describe('Christ Quote', () => {
    const hiddenQuote = (
      prefix: number,
      end: number,
    ): ChristQuoteDecorationSpec => ({
      kind: 'christ-quote',
      prefix,
      start: prefix + 1,
      end,
      prefixHidden: true,
      elisions: [],
    })

    it('lists each ellipsis inside the quote, three or more dots or the one-character mark', () => {
      expect(quotesFor('c"...teaching .... observe … all"')).toEqual([
        { ...hiddenQuote(0, 33), elisions: [
          { from: 2, to: 5 },
          { from: 14, to: 18 },
          { from: 27, to: 28 },
        ] },
      ])
    })

    it('hides the c and marks the quote from opening mark through closing mark', () => {
      expect(quotesFor('He said c"Abide in me" then')).toEqual([
        hiddenQuote(8, 22),
      ])
    })

    it('recognises curly marks', () => {
      expect(quotesFor('c“Abide in me”')).toEqual([hiddenQuote(0, 14)])
    })

    it('leaves a mid-word c, a capital C, a mismatched close and an unterminated quote alone', () => {
      expect(quotesFor('Isaac"laughed" C"no" c"open\n\nc"mixed” here')).toEqual(
        [],
      )
    })

    it('shows the c again but keeps the mark while the cursor touches the quote', () => {
      const doc = 'He said c"Abide in me" then'
      const touched: ChristQuoteDecorationSpec = {
        ...hiddenQuote(8, 22),
        prefixHidden: false,
      }

      expect(quotesFor(doc, [{ from: 8, to: 8 }])).toEqual([touched])
      expect(quotesFor(doc, [{ from: 12, to: 12 }])).toEqual([touched])
      expect(quotesFor(doc, [{ from: 22, to: 22 }])).toEqual([touched])
      expect(quotesFor(doc, [{ from: 2, to: 25 }])).toEqual([touched])
    })

    it('keeps both decorations while the cursor sits elsewhere', () => {
      const doc = 'He said c"Abide in me" then'

      expect(quotesFor(doc, [{ from: 3, to: 3 }])).toEqual([hiddenQuote(8, 22)])
      expect(quotesFor(doc, [{ from: 24, to: 27 }])).toEqual([
        hiddenQuote(8, 22),
      ])
    })

    it('emits each quote of a paragraph on its own', () => {
      expect(quotesFor('c"Abide" and c"in me"')).toEqual([
        hiddenQuote(0, 8),
        hiddenQuote(13, 21),
      ])
    })

    it('decorates a reference inside a quote alongside it', () => {
      const specs = allSpecsFor('c"Abide {John 15:4} in me"')

      expect(specs.map((spec) => [spec.kind, spec.start, spec.end])).toEqual([
        ['reference', 8, 19],
        ['christ-quote', 1, 26],
      ])
    })

    it('skips a quote in a code span, one escaped with a backslash, and one in frontmatter', () => {
      expect(quotesFor('---\ntitle: c"Abide"\n---\n`c"Abide"` c\\"in me"')).toEqual(
        [],
      )
    })

    it('skips a curly quote escaped with a backslash', () => {
      expect(quotesFor('c\\“Abide in me”')).toEqual([])
    })

    it('honors a code fence opened above the visible range', () => {
      const doc = '```\nc"Abide"\n```\n'

      expect(quotesFor(doc, [], [{ from: 4, to: doc.length }])).toEqual([])
    })

    it('keeps only quotes inside the visible ranges, at document offsets', () => {
      const doc = 'c"Abide"\n\nc"in me"\n\nc"always"'

      expect(quotesFor(doc, [], [{ from: 12, to: 18 }])).toEqual([
        hiddenQuote(10, 18),
      ])
    })

    it('scans nothing when no range is visible', () => {
      expect(quotesFor('c"Abide"', [], [])).toEqual([])
    })

    describe('a quote closes only within its paragraph', () => {
      it('not past a blank line', () => {
        expect(quotesFor('c"Abide\n\nin me"')).toEqual([])
      })

      it('not into a heading, which opens quotes of its own', () => {
        expect(quotesFor('c"Abide\n# heading c"x" more"')).toEqual([
          hiddenQuote(18, 22),
        ])
      })

      it('not into a list item', () => {
        expect(quotesFor('c"Abide\n- in me"')).toEqual([])
      })

      it('not past a table cell edge', () => {
        expect(quotesFor('| c"Abide | in me" |\n| c"Abide in me" |')).toEqual([
          hiddenQuote(23, 37),
        ])
      })

      it('not into a deeper blockquote line', () => {
        expect(quotesFor('c"Then\n> he left"')).toEqual([])
      })

      it('across a blockquote continuation line', () => {
        expect(quotesFor('> c"Abide\n> in me"')).toEqual([hiddenQuote(2, 18)])
      })

      it('across a lazy continuation line of a list item', () => {
        expect(quotesFor('- c"Abide\n  in me"')).toEqual([hiddenQuote(2, 18)])
      })
    })
  })

  describe('Page Break', () => {
    const pageBreak = (
      start: number,
      end: number,
      trailing = false,
    ): PageBreakDecorationSpec => ({ kind: 'page-break', start, end, trailing })

    it('emits a spec over the marker line, spaces included, at document offsets', () => {
      expect(pageBreaksFor('one\n\n  ===  \n\ntwo')).toEqual([pageBreak(5, 12)])
    })

    it('marks a break nothing follows as trailing and one at the note start as a break', () => {
      expect(pageBreaksFor('===\n\none\n\n===\n')).toEqual([
        pageBreak(0, 3),
        pageBreak(10, 13, true),
      ])
    })

    it('emits a spec when text follows the marker on the next line', () => {
      expect(pageBreaksFor('one\n\n===\ntwo')).toEqual([pageBreak(5, 8)])
    })

    it('skips a marker another marker underlines, a heading', () => {
      expect(pageBreaksFor('===\n===\n\n===\n')).toEqual([pageBreak(9, 12, true)])
    })

    it('emits page breaks beside references and quotes', () => {
      const specs = allSpecsFor('{John 15:4}\n\n===\n\nc"Abide"')

      expect(new Set(specs.map((spec) => spec.kind))).toEqual(
        new Set(['reference', 'christ-quote', 'page-break']),
      )
    })

    it('skips a marker in a fence, in frontmatter, under a text line, or with more text', () => {
      const doc =
        '---\n===\n---\n\n```\n===\n```\n\nHeading\n===\n\n=== more\n\n- ===\n\n> ===\n\n| === |'

      expect(pageBreaksFor(doc)).toEqual([])
    })

    it('skips a marker indented into an indented code block', () => {
      expect(pageBreaksFor('one\n\n    ===\n\ntwo')).toEqual([])
      expect(pageBreaksFor('one\n\n\t===\n\ntwo')).toEqual([])
    })

    it('keeps a marker under four spaces of indent', () => {
      expect(pageBreaksFor('one\n\n   ===\n\ntwo')).toEqual([pageBreak(5, 11)])
    })

    it('skips a marker under a line of text, the setext underline', () => {
      expect(pageBreaksFor('text\n===')).toEqual([])
      expect(pageBreaksFor('text\n===\ntext')).toEqual([])
    })

    it('emits nothing with page breaks off', () => {
      const specs = liveDecorationSpecs('===', [{ from: 0, to: 3 }], [], {
        ...context,
        pageBreaks: false,
      })

      expect(specs).toEqual([])
    })

    it('honors a code fence opened above the visible range', () => {
      const doc = '```\n\n===\n\n```\n'

      expect(pageBreaksFor(doc, [], [{ from: 4, to: doc.length }])).toEqual([])
    })

    it('does not mistake a `---` line at the visible-range start for frontmatter', () => {
      const doc = 'intro\n---\n\n===\n\n---\ntail'

      expect(pageBreaksFor(doc, [], [{ from: 6, to: doc.length }])).toEqual([
        pageBreak(11, 14),
      ])
    })

    it('skips frontmatter even when the visible range starts inside it', () => {
      const doc = '---\ntitle: x\n---\n===\n\ntail'

      expect(pageBreaksFor(doc, [], [{ from: 4, to: doc.length }])).toEqual([
        pageBreak(17, 20),
      ])
    })

    it('keeps only breaks inside the visible ranges', () => {
      const doc = '===\n\n===\n\n==='

      expect(pageBreaksFor(doc, [], [{ from: 5, to: 8 }])).toEqual([
        pageBreak(5, 8),
      ])
      expect(pageBreaksFor(doc, [], [])).toEqual([])
    })

    it('yields to the raw text while the cursor or a selection touches the line', () => {
      const doc = 'one\n\n===\n\ntwo'

      expect(pageBreaksFor(doc, [{ from: 5, to: 5 }])).toEqual([])
      expect(pageBreaksFor(doc, [{ from: 7, to: 7 }])).toEqual([])
      expect(pageBreaksFor(doc, [{ from: 8, to: 8 }])).toEqual([])
      expect(pageBreaksFor(doc, [{ from: 1, to: 12 }])).toEqual([])
    })

    it('keeps the widget while the cursor sits on another line', () => {
      const doc = 'one\n\n===\n\ntwo'

      expect(pageBreaksFor(doc, [{ from: 4, to: 4 }])).toHaveLength(1)
      expect(pageBreaksFor(doc, [{ from: 9, to: 9 }])).toHaveLength(1)
    })
  })
})
