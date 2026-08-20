import { describe, expect, it } from 'vitest'
import { parseSearchQuery } from './search-query'

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
