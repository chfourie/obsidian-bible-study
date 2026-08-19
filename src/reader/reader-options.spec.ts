import { describe, expect, it } from 'vitest'
import { readerOptionGroups } from './reader-options'

describe('readerOptionGroups', () => {
  it('lists the toggle groups in toolbar order without Strong\'s when untagged', () => {
    expect(readerOptionGroups(false).map((group) => group.key)).toEqual([
      'nav',
      'layout',
      'redLetter',
    ])
  })

  it('appends the Strong\'s group when the translation is tagged', () => {
    const groups = readerOptionGroups(true)
    expect(groups.map((group) => group.key)).toEqual([
      'nav',
      'layout',
      'redLetter',
      'strongs',
    ])
    expect(groups[groups.length - 1]).toEqual({
      key: 'strongs',
      label: "Strong's",
      options: [
        { value: 'off', label: 'Off' },
        { value: 'on', label: 'On' },
      ],
    })
  })

  it('describes each group with labelled value options', () => {
    const nav = readerOptionGroups(false)[0]
    expect(nav).toEqual({
      key: 'nav',
      label: 'Nav',
      options: [
        { value: 'tree', label: 'Tree' },
        { value: 'breadcrumb', label: 'Breadcrumb' },
      ],
    })
  })

  it('offers no details group — companion material lives in the Study Panel', () => {
    expect(
      readerOptionGroups(true).some((group) => group.label === 'Details'),
    ).toBe(false)
  })
})
