import type { StrongsEntryView, WordCloudWordView } from '../contracts'
import { strongsFamily } from '../modules'

// The families whose repetition carries no significance: the Greek article,
// the Hebrew article prefix, "to be", "and", and the Hebrew object marker.
// Deliberately nothing more — prepositions, quantifiers, negations and
// pronouns all stay, since their repetition can matter (CONTEXT.md — Cloud
// Exclusions).
export const CLOUD_EXCLUSIONS: ReadonlySet<string> = new Set([
  'G3588',
  'H9009',
  'H1961',
  'G1510',
  'G1096',
  'H9002',
  'G2532',
  'H853',
])

export const WORD_CLOUD_SIZE = 10

export const CLOUD_FONT_EM = { min: 0.9, max: 2 }

export type CloudSegment = { strongs?: string[] }

export type CloudVerse = { segments: readonly CloudSegment[] }

export type CloudFamily = { family: string; count: number }

export type CloudEntry = Pick<
  StrongsEntryView,
  'family' | 'gloss' | 'transliteration' | 'lemma'
>

// One tagged word per tag span: the span channels split a tagged word into
// several segments that all carry the same tag array, so a change of array
// is what marks the next word.
const taggedWords = (verse: CloudVerse): string[][] => {
  const words: string[][] = []
  let previous: string[] | undefined
  for (const segment of verse.segments) {
    if (segment.strongs !== undefined && segment.strongs !== previous)
      words.push(segment.strongs)
    previous = segment.strongs
  }
  return words
}

// The families the cloud shows, in chapter order: the ten most tagged — ties
// going to the earlier-appearing — reordered by first appearance so the
// cloud reads like the chapter rather than a league table.
export const cloudFamilies = (verses: readonly CloudVerse[]): CloudFamily[] => {
  const counts = new Map<string, number>()
  for (const verse of verses) {
    for (const word of taggedWords(verse)) {
      for (const number of word) {
        const family = strongsFamily(number)
        if (CLOUD_EXCLUSIONS.has(family)) continue
        counts.set(family, (counts.get(family) ?? 0) + 1)
      }
    }
  }
  const byAppearance = [...counts].map(([family, count], appearance) => ({
    family,
    count,
    appearance,
  }))
  return [...byAppearance]
    .sort((a, b) => b.count - a.count || a.appearance - b.appearance)
    .slice(0, WORD_CLOUD_SIZE)
    .sort((a, b) => a.appearance - b.appearance)
    .map(({ family, count }) => ({ family, count }))
}

// A family the dictionaries know nothing of still shows, under its number.
export const chapterWordCloud = (
  families: readonly CloudFamily[],
  entries: readonly CloudEntry[],
): WordCloudWordView[] => {
  const sizeEm = cloudSizer(families.map(({ count }) => count))
  return families.map(({ family, count }) => {
    const entry = entries.find((candidate) => candidate.family === family)
    return {
      family,
      gloss: entry?.gloss ?? family,
      transliteration: entry?.transliteration ?? '',
      lemma: entry?.lemma ?? '',
      count,
      sizeEm: sizeEm(count),
      active: false,
    }
  })
}

// Linear from the smallest count to the largest; a cloud of equal counts
// sits midway rather than shouting or whispering.
const cloudSizer = (counts: readonly number[]): ((count: number) => number) => {
  const smallest = Math.min(...counts)
  const largest = Math.max(...counts)
  const { min, max } = CLOUD_FONT_EM
  if (largest === smallest) return () => (min + max) / 2
  return (count) =>
    min + ((count - smallest) / (largest - smallest)) * (max - min)
}
