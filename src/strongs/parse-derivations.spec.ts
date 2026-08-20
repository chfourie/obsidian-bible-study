import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseGreekDerivations, parseHebrewDerivations } from './parse-derivations'

const hebrewSlice = readFileSync('tests/fixtures/strongs-hebrew-slice.xml', 'utf8')
const greekSlice = readFileSync('tests/fixtures/strongs-greek-slice.xml', 'utf8')

describe('parseHebrewDerivations', () => {
  it('keys each derivation by the padded Strong number of its entry', () => {
    const derivations = parseHebrewDerivations(hebrewSlice)

    expect(derivations.get('H0001')).toBe('a primitive word;')
    expect(derivations.get('H0006')).toBe('a primitive root;')
  })

  it('renders a cited number as the number itself, padded to match the lexicon', () => {
    const derivations = parseHebrewDerivations(hebrewSlice)

    expect(derivations.get('H0002')).toBe('(Aramaic) corresponding to H0001')
    expect(derivations.get('H0003')).toBe('from the same as H0024;')
    expect(derivations.get('H0010')).toBe('from H0001 and H3050;')
  })

  it('carries no derivation for an entry that states none', () => {
    const derivations = parseHebrewDerivations(hebrewSlice)

    expect(derivations.has('H0004')).toBe(false)
  })
})

describe('parseGreekDerivations', () => {
  it('keys each derivation by the padded Strong number of its entry', () => {
    const derivations = parseGreekDerivations(greekSlice)

    expect(derivations.get('G0001')).toBe('of Hebrew origin;')
  })

  it('renders cited numbers in the language the citation names', () => {
    const derivations = parseGreekDerivations(greekSlice)

    expect(derivations.get('G0002')).toBe('of Hebrew origin (H0175);')
    expect(derivations.get('G0004')).toBe(
      'from G0001 (as a negative particle) and G0922;',
    )
  })

  it('carries no derivation for an entry that states none', () => {
    const derivations = parseGreekDerivations(greekSlice)

    expect(derivations.has('G0003')).toBe(false)
  })
})
