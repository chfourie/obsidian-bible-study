import { describe, expect, it } from 'vitest'
import {
  CLOUD_EXCLUSIONS,
  chapterWordCloud,
  cloudFamilies,
  type CloudEntry,
} from './chapter-word-cloud'

type Tagged = string | string[]

// A verse written as its tagged words: a bare number tags one word with one
// number, an array tags one word with several.
const verse = (...words: Tagged[]) => ({
  segments: words.map((tags) => ({
    strongs: Array.isArray(tags) ? tags : [tags],
  })),
})

const entry = (family: string): CloudEntry => ({
  family,
  gloss: `gloss-${family}`,
  transliteration: `translit-${family}`,
  lemma: `lemma-${family}`,
})

const families = (...verses: ReturnType<typeof verse>[]) =>
  cloudFamilies(verses)

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
    const split = {
      segments: [{ strongs: tag }, { strongs: tag }],
    }

    expect(cloudFamilies([split])).toEqual([
      { family: 'G3306', count: 1 },
    ])
  })

  it('counts adjacent words that happen to share a family twice', () => {
    expect(families(verse('G281', 'G281'))).toEqual([
      { family: 'G281', count: 2 },
    ])
  })

  it('ignores untagged segments', () => {
    expect(cloudFamilies([{ segments: [{}] }])).toEqual([])
  })

  it('leaves out the Cloud Exclusions', () => {
    expect(cloudFamilies([verse('G3588', 'G26', 'G3588a')])).toEqual([
      { family: 'G26', count: 1 },
    ])
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

describe('chapterWordCloud', () => {
  it('names each family from its dictionary entry, inactive', () => {
    const words = chapterWordCloud(
      [{ family: 'G3306', count: 2 }],
      [entry('G3306')],
    )

    expect(words).toEqual([
      {
        family: 'G3306',
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
    const words = chapterWordCloud([{ family: 'G9999', count: 1 }], [])

    expect(words).toEqual([
      {
        family: 'G9999',
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
        { family: 'G1', count: 1 },
        { family: 'G2', count: 6 },
        { family: 'G3', count: 11 },
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
        { family: 'G1', count: 4 },
        { family: 'G2', count: 4 },
      ],
      [],
    )

    expect(words.map((word) => word.sizeEm)).toEqual([1.45, 1.45])
  })

  it('keeps the families in the given order whatever order the entries come in', () => {
    const words = chapterWordCloud(
      [
        { family: 'G1', count: 1 },
        { family: 'G2', count: 1 },
      ],
      [entry('G2'), entry('G1')],
    )

    expect(words.map((word) => word.family)).toEqual(['G1', 'G2'])
  })
})

describe('CLOUD_EXCLUSIONS', () => {
  it('holds exactly the articles, "to be", "and" and the object marker', () => {
    expect([...CLOUD_EXCLUSIONS].sort()).toEqual(
      ['G3588', 'H9009', 'H1961', 'G1510', 'G1096', 'H9002', 'G2532', 'H853'].sort(),
    )
  })
})
