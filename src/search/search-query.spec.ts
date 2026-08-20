import { describe, expect, it } from 'vitest'
import { matchSearchQuery, parseSearchQuery } from './search-query'

const matched = (text: string, query: string): string[] | null => {
  const spans = matchSearchQuery(text, parseSearchQuery(query))
  return spans === null
    ? null
    : spans.map((span) => text.slice(span.start, span.end))
}

describe('parseSearchQuery', () => {
  it('folds every word it takes in', () => {
    expect(parseSearchQuery('Ángeles')).toEqual({
      terms: [{ kind: 'word', word: 'angeles' }],
    })
  })

  it('takes each bare word as its own term', () => {
    expect(parseSearchQuery('love  god')).toEqual({
      terms: [
        { kind: 'word', word: 'love' },
        { kind: 'word', word: 'god' },
      ],
    })
  })

  it('takes a quoted run of words as one phrase term', () => {
    expect(parseSearchQuery('"in the beginning" God')).toEqual({
      terms: [
        { kind: 'phrase', words: ['in', 'the', 'beginning'] },
        { kind: 'word', word: 'god' },
      ],
    })
  })

  it('closes an unterminated quote at the end of the query', () => {
    expect(parseSearchQuery('"in the')).toEqual({
      terms: [{ kind: 'phrase', words: ['in', 'the'] }],
    })
  })

  it('drops punctuation and empty quotes', () => {
    expect(parseSearchQuery('love, "" god.')).toEqual({
      terms: [
        { kind: 'word', word: 'love' },
        { kind: 'word', word: 'god' },
      ],
    })
  })

  it('has no terms for a blank query', () => {
    expect(parseSearchQuery('   ')).toEqual({ terms: [] })
  })
})

describe('matchSearchQuery', () => {
  it('matches a word as a prefix', () => {
    expect(matched('And he loved them.', 'love')).toEqual(['loved'])
  })

  it('does not match a word inside another word', () => {
    expect(matched('My beloved son', 'love')).toBeNull()
  })

  it('ignores case in both text and query', () => {
    expect(matched('Love one another', 'LOVE')).toEqual(['Love'])
  })

  it('ignores diacritics in both text and query', () => {
    expect(matched('Los Ángeles', 'angeles')).toEqual(['Ángeles'])
    expect(matched('Los Angeles', 'Ángeles')).toEqual(['Angeles'])
  })

  it('requires every word of the query', () => {
    expect(matched('God is love', 'god love')).toEqual(['God', 'love'])
    expect(matched('God is good', 'god love')).toBeNull()
  })

  it('emphasizes every occurrence of a matched word', () => {
    expect(matched('Love loves love', 'love')).toEqual([
      'Love',
      'loves',
      'love',
    ])
  })

  it('reports spans in text order however the query was ordered', () => {
    expect(matched('God is love', 'love god')).toEqual(['God', 'love'])
  })

  it('requires the words of a phrase to be contiguous', () => {
    expect(matched('In the beginning God', '"in the beginning"')).toEqual([
      'In the beginning',
    ])
    expect(matched('In the very beginning', '"in the beginning"')).toBeNull()
  })

  it('prefix-matches the words inside a phrase', () => {
    expect(matched('the beginning of days', '"begin of"')).toEqual([
      'beginning of',
    ])
  })

  it('matches a phrase across intervening punctuation', () => {
    expect(matched('the Lord, the God of hosts', '"lord the"')).toEqual([
      'Lord, the',
    ])
  })

  it('matches non-Latin text through the same folding', () => {
    expect(matched('ἐν ἀρχῇ ἦν ὁ λόγος', 'λογος')).toEqual(['λόγος'])
    expect(matched('בְּרֵאשִׁית בָּרָא', 'ברא')).toEqual([
      'בְּרֵאשִׁית',
      'בָּרָא',
    ])
  })

  it('matches nothing when the query has no words', () => {
    expect(matched('God is love', '  ')).toBeNull()
  })
})
