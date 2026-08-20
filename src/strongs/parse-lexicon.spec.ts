import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseLexicon } from './parse-lexicon'

const hebrewSlice = readFileSync('tests/fixtures/tbesh-slice.txt', 'utf8')
const greekSlice = readFileSync('tests/fixtures/tbesg-slice.txt', 'utf8')

describe('parseLexicon', () => {
  it('extracts entries keyed by extended Strong number', () => {
    const { entries } = parseLexicon(hebrewSlice)
    const av = entries.get('H0001G')

    expect(av).toMatchObject({
      strongs: 'H0001',
      variant: 'H0001G',
      lemma: 'אָב',
      transliteration: 'av',
      gloss: 'father',
    })
    expect(av?.definition).toContain('father of an individual')
  })

  it('keeps every disambiguated sub-entry of a Strong number, not just the first', () => {
    const { entries } = parseLexicon(hebrewSlice)

    expect(entries.get('H0001G')?.gloss).toBe('father')
    expect(entries.get('H0001H')?.gloss).toBe('(Huram)-abi')
    expect(entries.get('H0001I')?.gloss).toBe('father of')
  })

  it('groups the sub-entries under the Strong Family they disambiguate', () => {
    const { families } = parseLexicon(hebrewSlice)

    expect(families.get('H0001')).toEqual(['H0001G', 'H0001H', 'H0001I'])
    expect(families.get('H0002')).toEqual(['H0002'])
  })

  it('keeps the morphology code beside the entry it describes', () => {
    const { entries } = parseLexicon(hebrewSlice)

    expect(entries.get('H0001G')?.morphology).toBe('H:N-M')
    expect(entries.get('H0002')?.morphology).toBe('A:N-M')
  })

  it('skips the licence preamble and non-entry rows', () => {
    const { entries } = parseLexicon(greekSlice)

    expect(entries.has('Herod@Mat.2.1=G2264G')).toBe(false)
    expect(entries.get('G0002')).toMatchObject({
      lemma: 'Ἀαρών',
      transliteration: 'Aarōn',
      gloss: 'Aaron',
    })
  })

  it('parses Greek entries despite a UTF-8 BOM', () => {
    const { entries } = parseLexicon(greekSlice)

    expect(entries.get('G0001G')?.gloss).toBe('Alpha')
    expect(entries.get('G0004')?.gloss).toBe('not burdensome')
  })
})
