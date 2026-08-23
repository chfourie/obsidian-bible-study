import { afterEach, describe, expect, it } from 'vitest'
import {
  HUMILITY_BOOK,
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import { maskInlineCodeSpans, scanReferenceMatches } from './scan-references'
import { makeVerseId } from './verse-id'

const john = (chapter: number, verse: number) => makeVerseId(43, chapter, verse)
const jude = (verse: number) => makeVerseId(65, 1, verse)

const single = (verseId: number) => [{ startId: verseId, endId: verseId }]

afterEach(() => {
  uninstallHumilityBook()
})

describe('maskInlineCodeSpans', () => {
  it('blanks code spans while preserving length and surrounding text', () => {
    expect(maskInlineCodeSpans('a `{John 15:4}` b')).toBe(
      `a ${' '.repeat('`{John 15:4}`'.length)} b`,
    )
  })

  it('leaves unclosed backtick runs and plain text untouched', () => {
    expect(maskInlineCodeSpans('no code here')).toBe('no code here')
    expect(maskInlineCodeSpans('open ` {John 15:4}')).toBe('open ` {John 15:4}')
  })
})

describe('scanReferenceMatches', () => {
  it('finds a match with brace-inclusive start and end offsets', () => {
    const matches = scanReferenceMatches('Abide: {John 15:4} in him.')

    expect(matches).toHaveLength(1)
    expect(matches[0].start).toBe(7)
    expect(matches[0].end).toBe(18)
    expect(matches[0].parsed.reference).toEqual({
      book: 43,
      ranges: [{ startId: john(15, 4), endId: john(15, 4) }],
    })
  })

  it('finds multiple matches in reading order', () => {
    const matches = scanReferenceMatches('{John 15:4} and {Jhn 15:9}')

    expect(matches.map((match) => match.start)).toEqual([0, 16])
  })

  it('classifies option tokens using the provided translation ids', () => {
    const matches = scanReferenceMatches('{John 15:4 nkjv block}', {
      translationIds: ['nkjv'],
    })

    expect(matches[0].parsed.translation).toBe('nkjv')
    expect(matches[0].parsed.display).toBe('block')
    expect(matches[0].parsed.invalidTokens).toEqual([])
  })

  it('ignores braces holding an invalid reference', () => {
    expect(scanReferenceMatches('{"json": true} {Nowhere 3:16}')).toEqual([])
  })

  it('ignores an escaped reference', () => {
    expect(scanReferenceMatches('\\{John 15:4}')).toEqual([])
  })

  it('never matches inside inline code spans', () => {
    expect(scanReferenceMatches('use `{John 15:4}` literally')).toEqual([])
  })

  it('matches after an inline code span closes', () => {
    const matches = scanReferenceMatches('`code` then {John 15:4}')

    expect(matches.map((match) => match.start)).toEqual([12])
  })

  it('never matches inside fenced code blocks', () => {
    const content = '```\n{John 15:4}\n```\n{John 15:9}\n'
    const matches = scanReferenceMatches(content)

    expect(matches.map((match) => match.start)).toEqual([
      content.indexOf('{John 15:9}'),
    ])
  })

  it('never matches inside frontmatter', () => {
    const content = '---\nref: John 15:4\ntitle: "{John 15:9}"\n---\n{John 15:1}\n'
    const matches = scanReferenceMatches(content)

    expect(matches.map((match) => match.start)).toEqual([
      content.indexOf('{John 15:1}'),
    ])
  })

  it('marks a full reference as not relative', () => {
    expect(scanReferenceMatches('{John 15:4}')[0].relativeSpec).toBeNull()
  })
})

describe('scanReferenceMatches relative references', () => {
  const scanAfterAnchor = (anchor: string, relative: string) =>
    scanReferenceMatches(`${anchor} then ${relative}`)

  it('resolves a chapter-less verse against the preceding full reference', () => {
    const matches = scanAfterAnchor('{John 15:4-9}', '{:5}')

    expect(matches).toHaveLength(2)
    expect(matches[1]).toEqual({
      start: '{John 15:4-9} then '.length,
      end: '{John 15:4-9} then {:5}'.length,
      relativeSpec: ':5',
      parsed: {
        reference: { book: 43, ranges: single(john(15, 5)) },
        translation: null,
        display: null,
        invalidTokens: [],
        highlights: [],
      },
    })
  })

  it('resolves a chapter-named verse within the anchor book', () => {
    const matches = scanAfterAnchor('{John 15:4-9}', '{15:7}')

    expect(matches[1].relativeSpec).toBe('15:7')
    expect(matches[1].parsed.reference.ranges).toEqual(single(john(15, 7)))
  })

  it('leaves a chapter outside the anchor as plain text', () => {
    expect(scanAfterAnchor('{John 15:4-9}', '{14:7}')).toHaveLength(1)
  })

  it('leaves a verse outside the anchor ranges as plain text', () => {
    expect(scanAfterAnchor('{John 15:4-6,9}', '{:7}')).toHaveLength(1)
    expect(scanAfterAnchor('{John 15:4-6,9}', '{15:10}')).toHaveLength(1)
  })

  it('resolves a chapter-less verse to the single anchor chapter holding it', () => {
    const matches = scanAfterAnchor('{John 14:31-15:3}', '{:1}')

    expect(matches[1].parsed.reference.ranges).toEqual(single(john(15, 1)))
  })

  it('leaves an ambiguous chapter-less verse as plain text', () => {
    expect(scanAfterAnchor('{John 14:1-15:3}', '{:1}')).toHaveLength(1)
  })

  it('resolves within a single-chapter book anchor', () => {
    const matches = scanAfterAnchor('{Jude 1-10}', '{:5}')

    expect(matches[1].parsed.reference.ranges).toEqual(single(jude(5)))
  })

  it('anchors to the nearest preceding full reference across lines', () => {
    const content = '# A\n{John 15:4-9}\n\n## B\n{John 3:16-17}\n\ntext {:17}\n'
    const matches = scanReferenceMatches(content)

    expect(matches).toHaveLength(3)
    expect(matches[2].parsed.reference.ranges).toEqual(single(john(3, 17)))
  })

  it('never lets a relative reference anchor a later one', () => {
    const matches = scanReferenceMatches('{John 15:4-9} {:5} {:9}')

    expect(matches.map((match) => match.parsed.reference.ranges)).toEqual([
      [{ startId: john(15, 4), endId: john(15, 9) }],
      single(john(15, 5)),
      single(john(15, 9)),
    ])
  })

  it('keeps the anchor when a relative reference is invalid', () => {
    const matches = scanReferenceMatches('{John 15:4-9} {:40} {:5}')

    expect(matches).toHaveLength(2)
    expect(matches[1].parsed.reference.ranges).toEqual(single(john(15, 5)))
  })

  it('leaves a relative reference before any full reference as plain text', () => {
    expect(scanReferenceMatches('{:5} and {John 15:4-9}')).toHaveLength(1)
  })

  it('never treats a bare number as a reference', () => {
    expect(scanAfterAnchor('{John 15:4-9}', '{5} {2024}')).toHaveLength(1)
  })

  it('ignores braces that are not a relative spec', () => {
    expect(
      scanAfterAnchor('{John 15:4-9}', '{"json": 5} {a:5} {:5:6} {:}'),
    ).toHaveLength(1)
  })

  it('honours escapes, code spans and fences', () => {
    const content =
      '{John 15:4-9}\n\\{:5} `{:5}`\n```\n{:5}\n```\n{:6}\n'
    const matches = scanReferenceMatches(content)

    expect(matches.map((match) => match.start)).toEqual([
      0,
      content.indexOf('{:6}'),
    ])
  })

  it('never takes an anchor from frontmatter', () => {
    const content = '---\nref: John 15:4-9\n---\n{:5}\n'

    expect(scanReferenceMatches(content)).toEqual([])
  })

  it('inherits the anchor translation when the spec names none', () => {
    const matches = scanReferenceMatches('{John 15:4-9 niv} {:5}', {
      translationIds: ['niv', 'kjv'],
    })

    expect(matches[1].parsed.translation).toBe('niv')
  })

  it('classifies option tokens after the spec as a full reference does', () => {
    const matches = scanReferenceMatches('{John 15:4-9 niv} {:5 kjv block bogus}', {
      translationIds: ['niv', 'kjv'],
    })

    expect(matches[1].parsed.translation).toBe('kjv')
    expect(matches[1].parsed.display).toBe('block')
    expect(matches[1].parsed.invalidTokens.map((token) => token.text)).toEqual([
      'bogus',
    ])
  })

  it('takes the display mode from the spec, defaulting to none', () => {
    const matches = scanReferenceMatches('{John 15:4-9} {:5 inline} {:6}')

    expect(matches[1].parsed.display).toBe('inline')
    expect(matches[2].parsed.display).toBeNull()
  })

  it('keeps a hand-typed highlight cue on the spec', () => {
    const matches = scanAfterAnchor('{John 15:4-9}', '{:5 h1/5.0-5.6}')

    expect(matches[1].parsed.highlights).toEqual([
      {
        slot: 1,
        startVerseId: john(15, 5),
        startChar: 0,
        endVerseId: john(15, 5),
        endChar: 6,
      },
    ])
  })

  it('resolves against a Book anchor', () => {
    installHumilityBook()
    const matches = scanAfterAnchor('{Humility 1:2-8}', '{:5}')

    expect(matches[1].parsed.reference).toEqual({
      book: HUMILITY_BOOK,
      ranges: single(makeVerseId(HUMILITY_BOOK, 1, 5)),
    })
  })

  it('resolves a comma list to every listed verse', () => {
    const matches = scanAfterAnchor('{John 15:4-9}', '{:5, :7}')

    expect(matches[1].relativeSpec).toBe(':5, :7')
    expect(matches[1].parsed.reference.ranges).toEqual([
      ...single(john(15, 5)),
      ...single(john(15, 7)),
    ])
  })

  it('keeps option tokens after a spaced comma list', () => {
    const matches = scanReferenceMatches('{John 15:4-9} {:5, :7 block}')

    expect(matches[1].relativeSpec).toBe(':5, :7')
    expect(matches[1].parsed.display).toBe('block')
  })

  it('accepts every range form', () => {
    const forms = ['{:5-:7}', '{:5-7}', '{15:5-:7}', '{15:5-7}']
    for (const form of forms) {
      const matches = scanAfterAnchor('{John 15:4-9}', form)
      expect(matches, form).toHaveLength(2)
      expect(matches[1].parsed.reference.ranges).toEqual([
        { startId: john(15, 5), endId: john(15, 7) },
      ])
    }
  })

  it('resolves a range that crosses into a named chapter', () => {
    const matches = scanAfterAnchor('{John 15:1-16:4}', '{:5-16:2}')

    expect(matches[1].parsed.reference.ranges).toEqual([
      { startId: john(15, 5), endId: john(16, 2) },
    ])
  })

  it('treats a bare range end as a verse in the current chapter', () => {
    const matches = scanAfterAnchor('{John 14:31-15:9}', '{15:2-4}')

    expect(matches[1].parsed.reference.ranges).toEqual([
      { startId: john(15, 2), endId: john(15, 4) },
    ])
  })

  it('rejects a range with any verse outside the anchor', () => {
    expect(scanAfterAnchor('{John 15:4-6,9}', '{:4-:9}')).toHaveLength(1)
    expect(scanAfterAnchor('{John 15:4-9}', '{:8-:12}')).toHaveLength(1)
  })

  it('rejects a range that runs backwards', () => {
    expect(scanAfterAnchor('{John 15:4-9}', '{:7-:5}')).toHaveLength(1)
  })

  it('lets later chapter-less segments inherit a named chapter', () => {
    const matches = scanAfterAnchor('{John 14:1-15:9}', '{15:2, :3}')

    expect(matches[1].parsed.reference.ranges).toEqual([
      { startId: john(15, 2), endId: john(15, 3) },
    ])
  })

  it('rejects an ambiguous chapter-less segment before any chapter is named', () => {
    expect(scanAfterAnchor('{John 14:1-15:9}', '{:3, 15:2}')).toHaveLength(1)
  })

  it('resolves a range within a single-chapter book anchor', () => {
    const matches = scanAfterAnchor('{Jude 1-10}', '{:5-7}')

    expect(matches[1].parsed.reference.ranges).toEqual([
      { startId: jude(5), endId: jude(7) },
    ])
  })

  it('resolves a list against a Book anchor', () => {
    installHumilityBook()
    const matches = scanAfterAnchor('{Humility 1:2-8}', '{:5, :7}')

    expect(matches[1].parsed.reference).toEqual({
      book: HUMILITY_BOOK,
      ranges: [
        ...single(makeVerseId(HUMILITY_BOOK, 1, 5)),
        ...single(makeVerseId(HUMILITY_BOOK, 1, 7)),
      ],
    })
  })

  it('flags a translation token after a Book anchor as invalid', () => {
    installHumilityBook()
    const matches = scanReferenceMatches('{Humility 1:2-8} {:5 web}', {
      translationIds: ['web'],
    })

    expect(matches[1].parsed.translation).toBeNull()
    expect(matches[1].parsed.invalidTokens.map((token) => token.text)).toEqual([
      'web',
    ])
  })
})
