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

  it('offers only Nav and the atom numbers of a paragraph Book', () => {
    const groups = readerOptionGroups({
      strongsAvailable: true,
      bookMode: true,
      atom: 'paragraph',
    })

    expect(groups.map((group) => group.key)).toEqual(['nav', 'atomNumbers'])
    expect(groups[1]).toEqual({
      key: 'atomNumbers',
      label: 'Para numbers',
      options: [
        { value: 'on', label: 'On' },
        { value: 'hover', label: 'Hover' },
      ],
    })
  })

  // The gutter is never called "para" on a Book that prints verses (§5).
  it('calls a verse-atom Book’s option Verse numbers', () => {
    const groups = readerOptionGroups({
      strongsAvailable: false,
      bookMode: true,
      atom: 'verse',
    })

    expect(groups[1].label).toBe('Verse numbers')
  })

  it('falls back to the paragraph wording while the Book’s kind is unknown', () => {
    const groups = readerOptionGroups({ strongsAvailable: false, bookMode: true })

    expect(groups[1].label).toBe('Para numbers')
  })
})
