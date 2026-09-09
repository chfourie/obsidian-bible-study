import { describe, expect, it } from 'vitest'
import { citing, removalsOffsetOf } from './text-removals'

describe('removalsOffsetOf', () => {
  it('maps an offset past every removal before it onto the shortened string', () => {
    const offsetOf = removalsOffsetOf([
      { at: 2, length: 3 },
      { at: 10, length: 4 },
    ])

    expect(offsetOf(0)).toBe(0)
    expect(offsetOf(2)).toBe(2)
    expect(offsetOf(5)).toBe(2)
    expect(offsetOf(9)).toBe(6)
    expect(offsetOf(14)).toBe(7)
  })

  it('is the identity when nothing was removed', () => {
    expect(removalsOffsetOf([])(7)).toBe(7)
  })
})

describe('citing', () => {
  it('returns what the function returns', () => {
    expect(citing('1:4', () => 'kept')).toBe('kept')
  })

  it('prefixes a failure with the atom locator', () => {
    expect(() =>
      citing('1.e1', () => {
        throw new Error('<x> is not a wrapper')
      }),
    ).toThrow('atom 1.e1: <x> is not a wrapper')
  })
})
