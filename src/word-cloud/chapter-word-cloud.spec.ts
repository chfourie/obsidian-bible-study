import { describe, expect, it } from 'vitest'
import {
  CLOUD_EXCLUSIONS,
  chapterWordCloud,
  cloudExclusions,
  cloudFamilies,
  type CloudEntry,
  type CloudVerse,
} from './chapter-word-cloud'

type Tagged = string | string[]

// A verse written as its tagged words: a bare number tags one word with one
// number, an array tags one word with several. Each word reads as its own
// number, so renderings are distinct unless a test says otherwise.
const verse = (...words: Tagged[]): CloudVerse => ({
  segments: words.map((tags) => ({
    text: Array.isArray(tags) ? tags.join(' ') : tags,
    strongs: Array.isArray(tags) ? tags : [tags],
  })),
})

// A verse written as "text:number" words, plain text where no number follows.
const rendered = (...words: string[]): CloudVerse => ({
  segments: words.map((word) => {
    const [text, number] = word.split(':')
    return number === undefined ? { text } : { text, strongs: [number] }
  }),
})

const entry = (family: string): CloudEntry => ({
  family,
  gloss: `gloss-${family}`,
  transliteration: `translit-${family}`,
  lemma: `lemma-${family}`,
})

const families = (...verses: CloudVerse[]) =>
  cloudFamilies(verses).map(({ family, count }) => ({ family, count }))

describe('cloudFamilies', () => {
  it('counts each family across the chapter', () => {
    expect(families(verse('G3306', 'G26'), verse('G3306'))).toEqual([
      { family: 'G3306', count: 2 },
      { family: 'G26', count: 1 },
    ])
  })

  it('collapses lettered numbers into their family before counting', () => {
    expect(families(verse('H4191a', 'H4191b', 'H4191'))).toEqual([
      { family: 'H4191', count: 3 },
    ])
  })

  it('counts a word tagged with several numbers once per number', () => {
    expect(families(verse(['G1722', 'G3306']))).toEqual([
      { family: 'G1722', count: 1 },
      { family: 'G3306', count: 1 },
    ])
  })

  it('counts one tag split across segments once', () => {
    const tag = ['G3306']
    const split: CloudVerse = {
      segments: [
        { text: 'ab', strongs: tag },
        { text: 'ide', strongs: tag },
      ],
    }

    expect(families(split)).toEqual([{ family: 'G3306', count: 1 }])
  })

  it('counts adjacent words that happen to share a family twice', () => {
    expect(families(verse('G281', 'G281'))).toEqual([
      { family: 'G281', count: 2 },
    ])
  })

  it('ignores untagged segments', () => {
    expect(families({ segments: [{ text: 'and' }] })).toEqual([])
  })

  it('leaves out the Cloud Exclusions', () => {
    expect(families(verse('G3588', 'G26', 'G3588a'))).toEqual([
      { family: 'G26', count: 1 },
    ])
  })

  it('matches an exclusion whether the tagging pads the number or not', () => {
    expect(families(verse('H853', 'H0853', 'H0834', 'H834', 'H3588'))).toEqual(
      [],
    )
  })

  it('leaves out the given exclusions instead of the built-in ones', () => {
    const ranked = cloudFamilies([verse('G26', 'G3588')], new Set(['G0026']))

    expect(ranked.map((word) => word.family)).toEqual(['G3588'])
  })

  it('takes the ten most frequent, ties broken by first appearance', () => {
    const words = Array.from({ length: 12 }, (_, index) => `G${index + 1}`)
    const twice = ['G3', 'G7']
    const ranked = families(verse(...words), verse(...twice))

    expect(ranked.map((word) => word.family)).toEqual([
      'G1',
      'G2',
      'G3',
      'G4',
      'G5',
      'G6',
      'G7',
      'G8',
      'G9',
      'G10',
    ])
  })

  it('drops the later-appearing of two tied families when only one fits', () => {
    const words = Array.from({ length: 11 }, (_, index) => `G${index + 1}`)
    const ranked = families(verse(...words), verse('G11'))

    expect(ranked.map((word) => word.family)).toContain('G11')
    expect(ranked.map((word) => word.family)).not.toContain('G10')
  })

  it('orders the chosen ten by first appearance, not by count', () => {
    const ranked = families(verse('G1', 'G2', 'G2', 'G3', 'G3', 'G3'))

    expect(ranked).toEqual([
      { family: 'G1', count: 1 },
      { family: 'G2', count: 2 },
      { family: 'G3', count: 3 },
    ])
  })
})

describe('cloudFamilies renderings', () => {
  it('headlines a family by the rendering the chapter uses most', () => {
    const ranked = cloudFamilies([
      rendered('love:G26', 'charity:G26', 'love:G26'),
    ])

    expect(ranked).toEqual([{ family: 'G26', count: 3, rendering: 'love' }])
  })

  it('breaks a tie by first appearance', () => {
    const ranked = cloudFamilies([rendered('charity:G26', 'love:G26')])

    expect(ranked[0].rendering).toBe('charity')
  })

  it('tallies renderings regardless of case, keeping the winning form as first written', () => {
    const ranked = cloudFamilies([
      rendered('LORD:H3068', 'Lord:H3068', 'lord:H3068', 'God:H3068'),
    ])

    expect(ranked[0].rendering).toBe('LORD')
  })

  it('trims punctuation and whitespace off a rendering', () => {
    const ranked = cloudFamilies([rendered(' love,:G26', 'love.:G26')])

    expect(ranked[0].rendering).toBe('love')
  })

  it('joins the text of a tagged word split across segments', () => {
    const tag = ['G26']
    const split: CloudVerse = {
      segments: [
        { text: 'lo', strongs: tag },
        { text: 've', strongs: tag },
      ],
    }

    expect(cloudFamilies([split])[0].rendering).toBe('love')
  })

  it('gives each number of a word tagged with several the same rendering', () => {
    const ranked = cloudFamilies([
      { segments: [{ text: 'in love', strongs: ['G1722', 'G26'] }] },
    ])

    expect(ranked.map((word) => word.rendering)).toEqual(['love', 'love'])
  })

  it('strips the function words a tag span drags in around the content word', () => {
    const ranked = cloudFamilies([
      rendered('You must carefully:H8104'),
      rendered('in order to know:H3045'),
      rendered('the LORD:H3068'),
      rendered('did not:H3808'),
      rendered('When you eat:H0398'),
      rendered('His commandments:H4687'),
    ])

    expect(ranked.map((word) => word.rendering)).toEqual([
      'carefully',
      'know',
      'LORD',
      'not',
      'eat',
      'commandments',
    ])
  })

  it('keeps a rendering made only of function words', () => {
    expect(cloudFamilies([rendered('so that:H4616')])[0].rendering).toBe(
      'so that',
    )
  })

  it('leaves the rendering empty when every occurrence is bare punctuation', () => {
    expect(cloudFamilies([rendered('—:G26')])[0].rendering).toBe('')
  })
})

describe('cloudExclusions', () => {
  it('joins the built-in list with the user list, padded to four digits', () => {
    const exclusions = cloudExclusions(['H4191', 'G26'])

    expect(exclusions.has('H4191')).toBe(true)
    expect(exclusions.has('G0026')).toBe(true)
    expect(exclusions.has('G3588')).toBe(true)
    expect(exclusions.size).toBe(CLOUD_EXCLUSIONS.size + 2)
  })

  it('folds a lettered user entry into its family', () => {
    expect(cloudExclusions(['H4191a']).has('H4191')).toBe(true)
  })
})

describe('chapterWordCloud', () => {
  it('names each family from its dictionary entry, inactive', () => {
    const words = chapterWordCloud(
      [{ family: 'G3306', count: 2, rendering: 'abide' }],
      [entry('G3306')],
    )

    expect(words).toEqual([
      {
        family: 'G3306',
        rendering: 'abide',
        gloss: 'gloss-G3306',
        transliteration: 'translit-G3306',
        lemma: 'lemma-G3306',
        count: 2,
        sizeEm: 1.45,
        active: false,
      },
    ])
  })

  it('shows a family with no entry under its number', () => {
    const words = chapterWordCloud(
      [{ family: 'G9999', count: 1, rendering: '' }],
      [],
    )

    expect(words).toEqual([
      {
        family: 'G9999',
        rendering: '',
        gloss: 'G9999',
        transliteration: '',
        lemma: '',
        count: 1,
        sizeEm: 1.45,
        active: false,
      },
    ])
  })

  it('sizes words linearly from 0.9em at the smallest count to 2em at the largest', () => {
    const words = chapterWordCloud(
      [
        { family: 'G1', count: 1, rendering: '' },
        { family: 'G2', count: 6, rendering: '' },
        { family: 'G3', count: 11, rendering: '' },
      ],
      [],
    )

    const [smallest, middle, largest] = words.map((word) => word.sizeEm)
    expect(smallest).toBe(0.9)
    expect(middle).toBeCloseTo(1.45)
    expect(largest).toBe(2)
  })

  it('sizes every word midway when the counts are all equal', () => {
    const words = chapterWordCloud(
      [
        { family: 'G1', count: 4, rendering: '' },
        { family: 'G2', count: 4, rendering: '' },
      ],
      [],
    )

    expect(words.map((word) => word.sizeEm)).toEqual([1.45, 1.45])
  })

  it('keeps the families in the given order whatever order the entries come in', () => {
    const words = chapterWordCloud(
      [
        { family: 'G1', count: 1, rendering: '' },
        { family: 'G2', count: 1, rendering: '' },
      ],
      [entry('G2'), entry('G1')],
    )

    expect(words.map((word) => word.family)).toEqual(['G1', 'G2'])
  })
})

describe('CLOUD_EXCLUSIONS', () => {
  it('holds exactly the articles, "to be", "and", the object marker, asher and ki', () => {
    expect([...CLOUD_EXCLUSIONS].sort()).toEqual(
      [
        'G3588',
        'H9009',
        'H1961',
        'G1510',
        'G1096',
        'H9002',
        'G2532',
        'H0853',
        'H0834',
        'H3588',
      ].sort(),
    )
  })
})
