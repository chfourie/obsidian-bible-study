import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BOOKS,
  bookIdForName,
  bookName,
  booksMatchingPrefix,
  deregisterBook,
  isNonBiblicalBook,
  registerBook,
  registeredBook,
  type RegisteredBook,
} from './books'

const HUMILITY_BOOK = 101

const humility = (
  overrides: Partial<RegisteredBook> = {},
): RegisteredBook => ({
  id: HUMILITY_BOOK,
  name: 'Humility',
  abbrev: 'Hum',
  aliases: [],
  moduleId: 'hum-m1895',
  editionCode: 'HUM-M1895',
  author: 'Andrew Murray',
  year: 1895,
  sections: [{ chapter: 0, name: 'Preface', named: true }],
  ...overrides,
})

afterEach(() => {
  deregisterBook(HUMILITY_BOOK)
  vi.restoreAllMocks()
})

describe('BOOKS', () => {
  it('lists all 66 books in Protestant/OSIS order', () => {
    expect(BOOKS).toHaveLength(66)
    expect(BOOKS[0].name).toBe('Genesis')
    expect(BOOKS[38].name).toBe('Malachi')
    expect(BOOKS[39].name).toBe('Matthew')
    expect(BOOKS[65].name).toBe('Revelation')
  })

  it('numbers books 1-66 by position', () => {
    BOOKS.forEach((book, index) => expect(book.id).toBe(index + 1))
  })
})

describe('bookName', () => {
  it('returns the canonical English name', () => {
    expect(bookName(43)).toBe('John')
    expect(bookName(22)).toBe('Song of Solomon')
    expect(bookName(9)).toBe('1 Samuel')
  })

  it('degrades to a numbered label for books outside the canon', () => {
    expect(bookName(101)).toBe('Book 101')
    expect(bookName(67)).toBe('Book 67')
    expect(bookName(0)).toBe('Book 0')
  })
})

describe('bookIdForName', () => {
  it('matches English full names', () => {
    expect(bookIdForName('John')).toBe(43)
    expect(bookIdForName('Genesis')).toBe(1)
    expect(bookIdForName('Song of Solomon')).toBe(22)
    expect(bookIdForName('1 Samuel')).toBe(9)
    expect(bookIdForName('Revelation')).toBe(66)
  })

  it('matches case-insensitively', () => {
    expect(bookIdForName('john')).toBe(43)
    expect(bookIdForName('GENESIS')).toBe(1)
    expect(bookIdForName('song OF solomon')).toBe(22)
  })

  it('matches OSIS abbreviations', () => {
    expect(bookIdForName('Gen')).toBe(1)
    expect(bookIdForName('Exod')).toBe(2)
    expect(bookIdForName('Judg')).toBe(7)
    expect(bookIdForName('1Sam')).toBe(9)
    expect(bookIdForName('Ps')).toBe(19)
    expect(bookIdForName('Eccl')).toBe(21)
    expect(bookIdForName('Matt')).toBe(40)
    expect(bookIdForName('Phlm')).toBe(57)
    expect(bookIdForName('Jas')).toBe(59)
    expect(bookIdForName('Rev')).toBe(66)
  })

  it('matches three-letter abbreviations', () => {
    expect(bookIdForName('Exo')).toBe(2)
    expect(bookIdForName('Jdg')).toBe(7)
    expect(bookIdForName('Psa')).toBe(19)
    expect(bookIdForName('Sng')).toBe(22)
    expect(bookIdForName('Jhn')).toBe(43)
    expect(bookIdForName('Php')).toBe(50)
    expect(bookIdForName('1Jn')).toBe(62)
  })

  it('matches common alternate names', () => {
    expect(bookIdForName('Psalm')).toBe(19)
    expect(bookIdForName('psalm')).toBe(19)
    expect(bookIdForName('Song of Songs')).toBe(22)
  })

  it('accepts an optional trailing period', () => {
    expect(bookIdForName('Gen.')).toBe(1)
    expect(bookIdForName('Matt.')).toBe(40)
  })

  it('accepts numbered books with or without a space', () => {
    expect(bookIdForName('1Jn')).toBe(62)
    expect(bookIdForName('1 Jn')).toBe(62)
    expect(bookIdForName('1 John')).toBe(62)
    expect(bookIdForName('1John')).toBe(62)
    expect(bookIdForName('2 Sam')).toBe(10)
    expect(bookIdForName('3 John')).toBe(64)
  })

  it('returns null for unknown names', () => {
    expect(bookIdForName('Enoch')).toBeNull()
    expect(bookIdForName('Johnny')).toBeNull()
    expect(bookIdForName('')).toBeNull()
    expect(bookIdForName('4 John')).toBeNull()
  })
})

describe('isNonBiblicalBook', () => {
  it('separates scripture from the book id space', () => {
    expect(isNonBiblicalBook(43)).toBe(false)
    expect(isNonBiblicalBook(66)).toBe(false)
    expect(isNonBiblicalBook(101)).toBe(true)
  })
})

describe('registerBook', () => {
  it('makes the book addressable by name, abbreviation and alias', () => {
    registerBook(humility({ aliases: ['Humility by Murray'] }))

    expect(bookIdForName('Humility')).toBe(HUMILITY_BOOK)
    expect(bookIdForName('humility')).toBe(HUMILITY_BOOK)
    expect(bookIdForName('Hum')).toBe(HUMILITY_BOOK)
    expect(bookIdForName('humility by murray')).toBe(HUMILITY_BOOK)
  })

  it('names the book for display and exposes its metadata', () => {
    registerBook(humility())

    expect(bookName(HUMILITY_BOOK)).toBe('Humility')
    expect(registeredBook(HUMILITY_BOOK)?.editionCode).toBe('HUM-M1895')
  })

  it('drops a name scripture already owns and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    registerBook(humility({ abbrev: 'Job' }))

    expect(bookIdForName('Job')).toBe(18)
    expect(bookIdForName('Humility')).toBe(HUMILITY_BOOK)
    expect(warn).toHaveBeenCalled()
  })

  it('offers the book to prefix completion', () => {
    registerBook(humility())

    expect(booksMatchingPrefix('Humi').map((book) => book.name)).toEqual([
      'Humility',
    ])
  })

  it('leaves a wholly shadowed book unaddressable but still named', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    registerBook(humility({ name: 'Jude', abbrev: 'Jud', aliases: [] }))

    expect(bookIdForName('Jude')).toBe(65)
    expect(booksMatchingPrefix('Jud').map((book) => book.id)).not.toContain(
      HUMILITY_BOOK,
    )
    expect(bookName(HUMILITY_BOOK)).toBe('Jude')
  })
})

describe('deregisterBook', () => {
  it('makes the name unknown again', () => {
    registerBook(humility())

    deregisterBook(HUMILITY_BOOK)

    expect(bookIdForName('Humility')).toBeNull()
    expect(registeredBook(HUMILITY_BOOK)).toBeNull()
    expect(bookName(HUMILITY_BOOK)).toBe('Book 101')
  })
})
