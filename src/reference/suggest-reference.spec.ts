import { describe, expect, it } from 'vitest'
import type { ParseOptions } from './parse-reference'
import { suggestReference } from './suggest-reference'

const options = { translationIds: ['nkjv', 'web', 'kjv'] }

const labels = (query: string, opts: ParseOptions = options) =>
  suggestReference(query, opts).map((suggestion) => suggestion.label)

describe('suggestReference — book completion', () => {
  it('suggests all books for an empty query', () => {
    const suggestions = suggestReference('', options)
    expect(suggestions).toHaveLength(66)
    expect(suggestions[0]).toEqual({
      label: 'Genesis',
      insert: 'Genesis ',
      replaceFrom: 0,
    })
  })

  it('suggests books matching a name prefix case-insensitively', () => {
    expect(labels('jo')).toEqual(['Joshua', 'Job', 'Joel', 'Jonah', 'John'])
    expect(labels('JOH')).toEqual(['John'])
  })

  it('completes numbered books across the space', () => {
    expect(labels('1 co')).toEqual(['1 Corinthians'])
    expect(suggestReference('1 co', options)[0]).toEqual({
      label: '1 Corinthians',
      insert: '1 Corinthians ',
      replaceFrom: 0,
    })
  })

  it('completes multi-word books past a word that is itself a book alias', () => {
    expect(labels('song of sol')).toEqual(['Song of Solomon'])
    expect(labels('song of')).toEqual(['Song of Solomon'])
    expect(labels('song of ')).toEqual(['Song of Solomon'])
  })

  it('matches abbreviations and aliases but labels the canonical name', () => {
    expect(labels('jhn')).toEqual(['John'])
    expect(labels('psalm')).toEqual(['Psalms'])
  })

  it('suggests nothing for an unmatchable prefix', () => {
    expect(labels('xyz')).toEqual([])
  })
})

describe('suggestReference — verse spec', () => {
  it('suggests nothing while the verse spec is being typed', () => {
    expect(labels('John ')).toEqual([])
    expect(labels('John 15')).toEqual([])
    expect(labels('John 15:4,7-9')).toEqual([])
  })
})

describe('suggestReference — option tokens', () => {
  it('suggests display keywords and translations after the spec', () => {
    expect(labels('John 15:4 ')).toEqual([
      'inline',
      'block',
      'nkjv',
      'web',
      'kjv',
    ])
  })

  it('replaces only the partial option token', () => {
    expect(suggestReference('John 15:4 b', options)).toEqual([
      { label: 'block', insert: 'block', replaceFrom: 10 },
    ])
  })

  it('filters by the partial token case-insensitively', () => {
    expect(labels('John 15:4 NK')).toEqual(['nkjv'])
  })

  it('omits option kinds that are already present', () => {
    expect(labels('John 15:4 block ')).toEqual(['nkjv', 'web', 'kjv'])
    expect(labels('John 15:4 nkjv ')).toEqual(['inline', 'block'])
  })

  it('suggests no translations when none are known', () => {
    expect(labels('John 15:4 ', {})).toEqual(['inline', 'block'])
  })
})
