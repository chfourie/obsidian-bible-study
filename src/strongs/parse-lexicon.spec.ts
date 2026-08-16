import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseLexicon } from './parse-lexicon'

const hebrewSlice = readFileSync('tests/fixtures/tbesh-slice.txt', 'utf8')
const greekSlice = readFileSync('tests/fixtures/tbesg-slice.txt', 'utf8')

describe('parseLexicon', () => {
  it('extracts entries keyed by extended Strong number', () => {
    const entries = parseLexicon(hebrewSlice)
    const av = entries.get('H0001')

    expect(av).toMatchObject({
      strongs: 'H0001',
      lemma: 'אָב',
      transliteration: 'av',
      gloss: 'father',
    })
    expect(av?.definition).toContain('father of an individual')
  })

  it('keeps the first row when a Strong number has disambiguated sub-entries', () => {
    const entries = parseLexicon(hebrewSlice)

    expect(entries.get('H0001')?.gloss).toBe('father')
  })

  it('skips the licence preamble and non-entry rows', () => {
    const entries = parseLexicon(greekSlice)

    expect(entries.has('Herod@Mat.2.1=G2264G')).toBe(false)
    expect(entries.get('G0002')).toMatchObject({
      lemma: 'Ἀαρών',
      transliteration: 'Aarōn',
      gloss: 'Aaron',
    })
  })

  it('parses Greek entries despite a UTF-8 BOM', () => {
    const entries = parseLexicon(greekSlice)

    expect(entries.get('G0001')?.gloss).toBe('Alpha')
    expect(entries.get('G0004')?.gloss).toBe('not burdensome')
  })
})
