import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
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

describe('suggestReference — installed books', () => {
  beforeEach(installHumilityBook)
  afterEach(uninstallHumilityBook)

  it('completes the book name once its module is installed', () => {
    expect(labels('humi')).toEqual(['Humility'])
    expect(labels('hum')).toEqual(['Humility'])
  })

  it('drops the book name again once the module is uninstalled', () => {
    uninstallHumilityBook()

    expect(labels('humi')).toEqual([])
  })

  it('surfaces the section number ↔ name mapping while typing the address', () => {
    expect(labels('Humility ')).toEqual([
      '0 — Preface',
      '1 — The Glory of the Creature',
      '2 — The Secret of Redemption',
      '3 — A Prayer for Humility',
    ])
    expect(suggestReference('Humility 0', options)).toEqual([
      { label: '0 — Preface', insert: '0:', replaceFrom: 9 },
    ])
  })

  it('stops suggesting sections once the paragraph is being typed', () => {
    expect(labels('Humility 1:')).toEqual([])
    expect(labels('Humility 1:6')).toEqual([])
  })

  it('offers display keywords but never translations on a book reference', () => {
    expect(labels('Humility 1:6 ')).toEqual(['inline', 'block'])
  })

  it('leaves scripture without section suggestions', () => {
    expect(labels('John ')).toEqual([])
  })
})

describe('suggestReference — relative spec', () => {
  it('offers display keywords and translations after a relative spec', () => {
    expect(labels(':5 ')).toEqual(['inline', 'block', 'nkjv', 'web', 'kjv'])
    expect(labels('15:2 ')).toEqual(['inline', 'block', 'nkjv', 'web', 'kjv'])
    expect(labels(':5-:7 ')).toEqual(['inline', 'block', 'nkjv', 'web', 'kjv'])
  })

  it('carries the option suggestions past a comma-separated spec', () => {
    expect(labels(':5, :7 ')).toEqual(['inline', 'block', 'nkjv', 'web', 'kjv'])
  })

  it('omits option kinds already present on the relative reference', () => {
    expect(labels(':5 block ')).toEqual(['nkjv', 'web', 'kjv'])
    expect(labels(':5 kjv ')).toEqual(['inline', 'block'])
  })

  it('replaces only the partial option token', () => {
    expect(suggestReference(':5 b', options)).toEqual([
      { label: 'block', insert: 'block', replaceFrom: 3 },
    ])
  })

  it('suggests no addresses while the relative spec is being typed', () => {
    expect(labels(':')).toEqual([])
    expect(labels(':1')).toEqual([])
    expect(labels(':5-')).toEqual([])
    expect(labels('15:')).toEqual([])
  })
})
