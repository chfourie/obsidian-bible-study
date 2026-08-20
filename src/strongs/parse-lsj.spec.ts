import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseLsjLexicon } from './parse-lsj'

const slice = readFileSync('tests/fixtures/tflsj-slice.txt', 'utf8')

describe('parseLsjLexicon', () => {
  it('keys the full entry by the extended Strong number', () => {
    const entries = parseLsjLexicon(slice)

    expect(entries.get('G0035')).toContain('of unrecorded descent')
  })

  it('keeps every disambiguated sub-entry apart', () => {
    const entries = parseLsjLexicon(slice)

    expect(entries.get('G0001G')).toContain('ἄλφα')
    expect(entries.get('G0001H')).toContain('Epic dialect')
  })

  it('answers a bare family number with its first sub-entry', () => {
    const entries = parseLsjLexicon(slice)

    expect(entries.get('G0001')).toBe(entries.get('G0001G'))
    expect(entries.get('G0223')).toBe(entries.get('G0223G'))
  })

  it('reads the five-digit numbers of the extra lexicon', () => {
    const entries = parseLsjLexicon(slice)

    expect(entries.get('G20001')).toContain('to be made desert')
  })

  it('skips the licence preamble and the column headings', () => {
    const entries = parseLsjLexicon(slice)

    expect(entries.has('eStrong')).toBe(false)
    expect(entries.has('See also:')).toBe(false)
  })

  it('parses the first entry despite a UTF-8 BOM', () => {
    expect(parseLsjLexicon(`\uFEFF${slice}`).get('G0001G')).toContain('ἄλφα')
  })

  it('reads an entry LSJ itself carries nothing for', () => {
    const entries = parseLsjLexicon(slice)

    expect(entries.get('G0005')).toContain('Not in LSJ.')
  })
})
