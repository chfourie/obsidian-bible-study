import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  HUMILITY_BOOK,
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import { bookCitation } from './book-citation'
import { parseReference } from './parse-reference'
import type { Reference } from './verse-range'

const referenceOf = (text: string): Reference => {
  const parsed = parseReference(text)
  if (!parsed) throw new Error(`unparseable: ${text}`)
  return parsed.reference
}

const locatorOf = (text: string): string | undefined =>
  bookCitation(referenceOf(text))?.locator

beforeEach(installHumilityBook)
afterEach(uninstallHumilityBook)

describe('bookCitation', () => {
  it('reads a single paragraph as an MLA locator', () => {
    expect(locatorOf('Humility 2:2')).toBe('ch. 2, par. 2')
  })

  it('replaces the chapter locator with a named section', () => {
    expect(locatorOf('Humility 0:3')).toBe('Preface, par. 3')
    expect(locatorOf('Humility 3:1')).toBe('A Prayer for Humility, par. 1')
  })

  it('keeps a titled chapter numbered', () => {
    expect(locatorOf('Humility 1:6')).toBe('ch. 1, par. 6')
  })

  it('pluralizes across a paragraph range or list', () => {
    expect(locatorOf('Humility 1:2-4')).toBe('ch. 1, pars. 2-4')
    expect(locatorOf('Humility 1:2,7')).toBe('ch. 1, pars. 2,7')
  })

  it('names the section alone for a whole chapter', () => {
    expect(locatorOf('Humility 2')).toBe('ch. 2')
    expect(locatorOf('Humility 0')).toBe('Preface')
  })

  it('spans a cross-chapter range end to end', () => {
    expect(locatorOf('Humility 1:8-2:2')).toBe(
      'ch. 1, par. 8 – ch. 2, par. 2',
    )
  })

  it('builds the reference text and full citation from manifest metadata', () => {
    expect(bookCitation(referenceOf('Humility 2:2'))).toMatchObject({
      title: 'Humility',
      reference: 'Humility ch. 2, par. 2',
      attribution: 'Andrew Murray, Humility (1895), ch. 2, par. 2',
      editionCode: 'HUM-M1895',
      moduleId: 'hum-m1895',
    })
  })

  it('returns null for scripture', () => {
    expect(bookCitation(referenceOf('John 3:16'))).toBeNull()
  })

  it('returns null once the module is uninstalled', () => {
    const reference = referenceOf('Humility 2:2')

    uninstallHumilityBook()

    expect(bookCitation(reference)).toBeNull()
    expect(reference.book).toBe(HUMILITY_BOOK)
  })
})
