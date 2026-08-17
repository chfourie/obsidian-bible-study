import { describe, expect, it } from 'vitest'
import { readerOptionGroups } from './reader-options'

describe('readerOptionGroups', () => {
  it('lists the toggle groups in toolbar order without Strong\'s when untagged', () => {
    expect(readerOptionGroups(false).map((group) => group.key)).toEqual([
      'details',
      'nav',
      'layout',
      'redLetter',
    ])
  })

  it('appends the Strong\'s group when the translation is tagged', () => {
    const groups = readerOptionGroups(true)
    expect(groups.map((group) => group.key)).toEqual([
      'details',
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
    const details = readerOptionGroups(false)[0]
    expect(details).toEqual({
      key: 'details',
      label: 'Details',
      options: [
        { value: 'inline', label: 'Inline' },
        { value: 'side-panel', label: 'Side panel' },
      ],
    })
  })
})
