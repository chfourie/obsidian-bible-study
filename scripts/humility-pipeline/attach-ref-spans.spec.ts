import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseReference } from '../../src/reference/parse-reference'
import { makeVerseId } from '../../src/reference/verse-id'
import { attachRefSpans, parseRefOverrides } from './attach-ref-spans'
import type { ParsedSection } from './parse-humility-text'

const BOOK = 101
const JOHN = 43
const LUKE = 42
const MATTHEW = 40

const sections = (): ParsedSection[] => [
  {
    chapter: 1,
    name: 'The Glory of the Creature',
    epigraphs: [{ quote: 'Worthy art Thou.', attribution: 'REV. iv. 11.' }],
    paragraphs: [
      { text: "'I seek not Mine own will' (John v. 30). (See Note A.)" },
      { text: 'The strife among them (Luke 9:46) was plain.' },
    ],
  },
  {
    chapter: 13,
    name: 'Note A',
    named: true,
    paragraphs: [{ text: 'All this is to make it known.' }],
  },
]

const attach = (overrides = {}): ParsedSection[] =>
  attachRefSpans(BOOK, sections(), overrides)

const paragraphRefs = (attached: ParsedSection[], index: number) =>
  attached[0].paragraphs[index].refs ?? []

const LUKE_FIX = {
  fix: [
    { at: '1.2', text: 'Luke 9:46', reference: 'Luke 9:46' },
  ],
}

describe('attachRefSpans', () => {
  it('attaches the parsed spans to the paragraph that holds them', () => {
    const attached = attach(LUKE_FIX)
    const text = attached[0].paragraphs[0].text
    expect(
      paragraphRefs(attached, 0).map((span) => text.slice(span.start, span.end)),
    ).toEqual(['John v. 30', 'See Note A.'])
  })

  it('resolves a Note pointer to every paragraph of that note section', () => {
    const pointer = paragraphRefs(attach(LUKE_FIX), 0)[1]
    expect(pointer.ranges).toEqual([
      { startId: makeVerseId(BOOK, 13, 1), endId: makeVerseId(BOOK, 13, 1) },
    ])
  })

  it('attaches epigraph spans over the attribution line', () => {
    const epigraph = attach(LUKE_FIX)[0].epigraphs?.[0]
    expect(epigraph?.refs).toEqual([
      {
        start: 0,
        end: 11,
        ranges: [
          { startId: makeVerseId(66, 4, 11), endId: makeVerseId(66, 4, 11) },
        ],
      },
    ])
  })

  it('leaves a paragraph without citations free of a refs channel', () => {
    expect(attach(LUKE_FIX)[1].paragraphs[0].refs).toBeUndefined()
  })

  it('fails the build on a citation neither parsed nor overridden', () => {
    expect(() => attach()).toThrow(/1\.2.*\(Luke 9:46\)/s)
  })

  it('applies a fix override as a span over the matched text', () => {
    const attached = attach(LUKE_FIX)
    const text = attached[0].paragraphs[1].text
    const [span] = paragraphRefs(attached, 1)
    expect(text.slice(span.start, span.end)).toBe('Luke 9:46')
    expect(span.ranges).toEqual([
      { startId: makeVerseId(LUKE, 9, 46), endId: makeVerseId(LUKE, 9, 46) },
    ])
  })

  it('lets a fix override replace a span the parser already produced', () => {
    const attached = attachRefSpans(BOOK, sections(), {
      ...LUKE_FIX,
      fix: [
        ...LUKE_FIX.fix,
        { at: '1.1', text: 'John v. 30', reference: 'Matthew 5:3' },
      ],
    })
    expect(paragraphRefs(attached, 0)[0].ranges).toEqual([
      { startId: makeVerseId(MATTHEW, 5, 3), endId: makeVerseId(MATTHEW, 5, 3) },
    ])
    expect(paragraphRefs(attached, 0)).toHaveLength(2)
  })

  it('fails the build when a fix override no longer matches its text', () => {
    expect(() =>
      attachRefSpans(BOOK, sections(), {
        ...LUKE_FIX,
        fix: [
          ...LUKE_FIX.fix,
          { at: '1.1', text: 'John vi. 30', reference: 'John 6:30' },
        ],
      }),
    ).toThrow(/John vi\. 30/)
  })

  it('fails the build when a fix override names an atom that is gone', () => {
    expect(() =>
      attachRefSpans(BOOK, sections(), {
        ...LUKE_FIX,
        fix: [
          ...LUKE_FIX.fix,
          { at: '9.4', text: 'John v. 30', reference: 'John 5:30' },
        ],
      }),
    ).toThrow(/9\.4/)
  })

  it('fails the build when a fix override cites an unparseable reference', () => {
    expect(() =>
      attachRefSpans(BOOK, sections(), {
        fix: [{ at: '1.2', text: 'Luke 9:46', reference: 'Nowhere 9:46' }],
      }),
    ).toThrow(/Nowhere 9:46/)
  })

  it('drops a suppressed span and leaves the rest attached', () => {
    const attached = attachRefSpans(BOOK, sections(), {
      ...LUKE_FIX,
      suppress: [{ at: '1.1', text: 'John v. 30' }],
    })
    const text = attached[0].paragraphs[0].text
    expect(
      paragraphRefs(attached, 0).map((span) => text.slice(span.start, span.end)),
    ).toEqual(['See Note A.'])
  })

  it('fails the build when a suppression matches no parsed span', () => {
    expect(() =>
      attachRefSpans(BOOK, sections(), {
        ...LUKE_FIX,
        suppress: [{ at: '1.1', text: 'Mine own will' }],
      }),
    ).toThrow(/Mine own will/)
  })

  it('addresses an epigraph override by its position in the section', () => {
    const attached = attachRefSpans(BOOK, sections(), {
      ...LUKE_FIX,
      fix: [
        ...LUKE_FIX.fix,
        { at: '1.e1', text: 'REV. iv. 11.', reference: 'John 3:16' },
      ],
    })
    expect(attached[0].epigraphs?.[0].refs).toEqual([
      {
        start: 0,
        end: 12,
        ranges: [
          { startId: makeVerseId(JOHN, 3, 16), endId: makeVerseId(JOHN, 3, 16) },
        ],
      },
    ])
  })

  it('fails the build on an epigraph attribution it cannot resolve', () => {
    const mangled = sections()
    mangled[0].epigraphs = [
      { quote: 'Worthy art Thou.', attribution: 'REV. xcix. 11.' },
    ]
    expect(() => attachRefSpans(BOOK, mangled, LUKE_FIX)).toThrow(
      /1\.e1.*REV\. xcix\. 11\./s,
    )
  })
})

describe('parseRefOverrides', () => {
  it('reads the fix and suppress lists', () => {
    expect(
      parseRefOverrides(
        '{"fix":[{"at":"1.2","text":"Luke 9:46","reference":"Luke 9:46"}],' +
          '"suppress":[{"at":"3.1","text":"Co. i. 1"}]}',
      ),
    ).toEqual({
      fix: [{ at: '1.2', text: 'Luke 9:46', reference: 'Luke 9:46' }],
      suppress: [{ at: '3.1', text: 'Co. i. 1' }],
    })
  })

  it('defaults both lists to empty', () => {
    expect(parseRefOverrides('{}')).toEqual({ fix: [], suppress: [] })
  })

  it('rejects an entry missing its fields', () => {
    expect(() => parseRefOverrides('{"fix":[{"at":"1.2"}]}')).toThrow(
      /fix override/i,
    )
  })

  it('rejects a suppression missing its fields', () => {
    expect(() => parseRefOverrides('{"suppress":[{"text":"x"}]}')).toThrow(
      /suppress override/i,
    )
  })
})

// The overrides that ship with the pipeline. Whether they are still live is
// settled against the real source at build time; the suite keeps them
// readable and keeps every reference they supply resolvable.
describe('the shipped ref overrides', () => {
  const overrides = parseRefOverrides(
    readFileSync('scripts/humility-pipeline/ref-overrides.json', 'utf8'),
  )

  const SECOND_CORINTHIANS = 47

  it('addresses a paragraph or an epigraph with every fix', () => {
    expect(overrides.fix.map((entry) => entry.at)).toEqual([
      '4.4',
      '4.4',
      '4.6',
      '11.e1',
    ])
  })

  it('supplies a resolvable reference with every fix', () => {
    expect(
      overrides.fix.map((entry) => parseReference(entry.reference)?.reference),
    ).toEqual([
      {
        book: LUKE,
        ranges: [
          { startId: makeVerseId(LUKE, 9, 46), endId: makeVerseId(LUKE, 9, 46) },
        ],
      },
      {
        book: MATTHEW,
        ranges: [
          {
            startId: makeVerseId(MATTHEW, 18, 3),
            endId: makeVerseId(MATTHEW, 18, 3),
          },
        ],
      },
      {
        book: MATTHEW,
        ranges: [
          {
            startId: makeVerseId(MATTHEW, 23, 11),
            endId: makeVerseId(MATTHEW, 23, 11),
          },
        ],
      },
      {
        book: SECOND_CORINTHIANS,
        ranges: [
          {
            startId: makeVerseId(SECOND_CORINTHIANS, 12, 9),
            endId: makeVerseId(SECOND_CORINTHIANS, 12, 10),
          },
        ],
      },
    ])
  })

  it('suppresses nothing — the scanner produces no false positive', () => {
    expect(overrides.suppress).toEqual([])
  })
})
