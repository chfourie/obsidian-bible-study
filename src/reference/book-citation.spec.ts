import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  HUMILITY_BOOK,
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import {
  installEnochBook,
  uninstallEnochBook,
} from '../../tests/fixtures/enoch-book'
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

describe('bookCitation on a verse-atom Book', () => {
  beforeEach(installEnochBook)
  afterEach(uninstallEnochBook)

  // Spec-books §4: one locator string per grammar form, scripture's numeric
  // family with no `ch.` / `par.` wording.
  it.each([
    ['1 Enoch 1:9', '1:9'],
    ['1 Enoch 1:9-11', '1:9-11'],
    ['1 Enoch 1:9,11', '1:9,11'],
    ['1 Enoch 1', '1'],
    ['1 Enoch 1-2', '1-2'],
    ['1 Enoch 1:9-2:3', '1:9-2:3'],
    ['1 Enoch', ''],
  ])('reads %s as the locator %s', (text, locator) => {
    expect(locatorOf(text)).toBe(locator)
  })

  it('carries the Book’s atom kind so the chip knows the locator family', () => {
    expect(bookCitation(referenceOf('1 Enoch 1:9'))?.atom).toBe('verse')
    expect(bookCitation(referenceOf('Humility 2:2'))?.atom).toBe('paragraph')
  })

  it('builds the reference text and full citation from manifest metadata', () => {
    expect(bookCitation(referenceOf('1 Enoch 1:9-11'))).toMatchObject({
      title: '1 Enoch',
      reference: '1 Enoch 1:9-11',
      attribution: 'Enoch, 1 Enoch (1912), 1:9-11',
      editionCode: '1EN-C1912',
      moduleId: '1en-c1912',
    })
  })

  it('invents no verse span for a whole-book reference', () => {
    expect(bookCitation(referenceOf('1 Enoch'))).toMatchObject({
      reference: '1 Enoch',
      attribution: 'Enoch, 1 Enoch (1912)',
    })
    expect(bookCitation(referenceOf('Humility'))).toMatchObject({
      reference: 'Humility',
      attribution: 'Andrew Murray, Humility (1895)',
    })
  })

  it('resolves the Book’s aliases onto the same locator', () => {
    expect(locatorOf('1En 1:9')).toBe('1:9')
    expect(locatorOf('Book of Enoch 1:9')).toBe('1:9')
  })
})
