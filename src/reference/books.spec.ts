import { describe, expect, it } from 'vitest'
import { BOOKS, bookIdForName, bookName } from './books'

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
