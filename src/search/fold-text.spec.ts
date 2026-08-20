import { describe, expect, it } from 'vitest'
import { foldText, tokenizeText } from './fold-text'

describe('foldText', () => {
  it('lowercases', () => {
    expect(foldText('Love')).toBe('love')
  })

  it('strips Latin diacritics', () => {
    expect(foldText('Ángeles')).toBe('angeles')
    expect(foldText('Noël')).toBe('noel')
  })

  it('strips Greek accents and breathings', () => {
    expect(foldText('ἀγάπη')).toBe('αγαπη')
    expect(foldText('Θεός')).toBe('θεος')
  })

  it('strips Hebrew vowel points', () => {
    expect(foldText('בְּרֵאשִׁית')).toBe('בראשית')
  })

  it('leaves plain text alone', () => {
    expect(foldText('in the beginning')).toBe('in the beginning')
  })
})

describe('tokenizeText', () => {
  it('records each word folded, with its offsets into the original text', () => {
    expect(tokenizeText('God is Love')).toEqual([
      { start: 0, end: 3, folded: 'god' },
      { start: 4, end: 6, folded: 'is' },
      { start: 7, end: 11, folded: 'love' },
    ])
  })

  it('breaks words on punctuation, keeping the offsets exact', () => {
    const text = "the LORD's word, indeed."
    const tokens = tokenizeText(text)
    expect(tokens.map((token) => text.slice(token.start, token.end))).toEqual([
      'the',
      'LORD',
      's',
      'word',
      'indeed',
    ])
  })

  it('keeps combining marks inside the word they decorate', () => {
    const tokens = tokenizeText('Noe\u0308l came')
    expect(tokens).toEqual([
      { start: 0, end: 5, folded: 'noel' },
      { start: 6, end: 10, folded: 'came' },
    ])
  })

  it('tokenizes non-Latin scripts', () => {
    const text = 'ἐν ἀρχῇ ἦν ὁ λόγος'
    expect(tokenizeText(text).map((token) => token.folded)).toEqual([
      'εν',
      'αρχη',
      'ην',
      'ο',
      'λογος',
    ])
  })

  it('finds no words in punctuation alone', () => {
    expect(tokenizeText(' — , ')).toEqual([])
  })
})
