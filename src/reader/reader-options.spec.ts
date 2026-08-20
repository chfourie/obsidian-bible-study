import { describe, expect, it } from 'vitest'
import { readerOptionGroups } from './reader-options'

describe('readerOptionGroups', () => {
  it('lists the toggle groups in toolbar order without Strong\'s when untagged', () => {
    expect(
      readerOptionGroups({ strongsAvailable: false, bookMode: false }).map(
        (group) => group.key,
      ),
    ).toEqual(['nav', 'layout', 'redLetter'])
  })

  it('appends the Strong\'s group when the translation is tagged', () => {
    const groups = readerOptionGroups({
      strongsAvailable: true,
      bookMode: false,
    })
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
    const nav = readerOptionGroups({
      strongsAvailable: false,
      bookMode: false,
    })[0]
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
      readerOptionGroups({ strongsAvailable: true, bookMode: false }).some(
        (group) => group.label === 'Details',
      ),
    ).toBe(false)
  })

  it('offers only Nav and Para numbers in book mode', () => {
    const groups = readerOptionGroups({
      strongsAvailable: true,
      bookMode: true,
    })

    expect(groups.map((group) => group.key)).toEqual(['nav', 'paraNumbers'])
    expect(groups[1]).toEqual({
      key: 'paraNumbers',
      label: 'Para numbers',
      options: [
        { value: 'on', label: 'On' },
        { value: 'hover', label: 'Hover' },
      ],
    })
  })
})
