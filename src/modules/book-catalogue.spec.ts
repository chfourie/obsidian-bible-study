import { describe, expect, it } from 'vitest'
import { BOOK_CATALOGUE, BOOK_MODULE_IDS, bookRelease } from './book-catalogue'

describe('BOOK_CATALOGUE', () => {
  it('ships every compiled-in book', () => {
    expect(BOOK_CATALOGUE).toEqual([
      {
        moduleId: 'hum-m1895',
        title: 'Humility',
        author: 'Andrew Murray',
        editionCode: 'HUM-M1895',
        tag: 'hum-m1895-module',
        filename: 'hum-m1895-module.json',
      },
      {
        moduleId: 'in-at-e1',
        title: 'IN',
        author: 'A Team',
        editionCode: 'IN-AT-E1',
        tag: 'in-at-e1-module',
        filename: 'in-at-e1-module.json',
      },
    ])
  })

  it('derives the module id from the edition code, lowercased', () => {
    for (const entry of BOOK_CATALOGUE) {
      expect(entry.moduleId).toBe(entry.editionCode.toLowerCase())
    }
  })

  it('lists every catalogued book module id', () => {
    expect(BOOK_MODULE_IDS).toEqual(['hum-m1895', 'in-at-e1'])
  })

  it('derives the release coordinates a prebuilt client downloads from', () => {
    expect(bookRelease(BOOK_CATALOGUE[0])).toEqual({
      moduleId: 'hum-m1895',
      tag: 'hum-m1895-module',
      filename: 'hum-m1895-module.json',
    })
  })
})
