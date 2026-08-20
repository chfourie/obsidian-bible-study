import { describe, expect, it } from 'vitest'
import { BOOK_CATALOGUE, BOOK_MODULE_IDS, bookRelease } from './book-catalogue'

describe('BOOK_CATALOGUE', () => {
  it('ships Humility as the compiled-in v1 entry', () => {
    expect(BOOK_CATALOGUE).toEqual([
      {
        moduleId: 'hum-m1895',
        title: 'Humility',
        author: 'Andrew Murray',
        editionCode: 'HUM-M1895',
        tag: 'hum-m1895-module',
        filename: 'hum-m1895-module.json',
      },
    ])
  })

  it('derives the module id from the edition code, lowercased', () => {
    for (const entry of BOOK_CATALOGUE) {
      expect(entry.moduleId).toBe(entry.editionCode.toLowerCase())
    }
  })

  it('lists every catalogued book module id', () => {
    expect(BOOK_MODULE_IDS).toEqual(['hum-m1895'])
  })

  it('derives the release coordinates a prebuilt client downloads from', () => {
    expect(bookRelease(BOOK_CATALOGUE[0])).toEqual({
      moduleId: 'hum-m1895',
      tag: 'hum-m1895-module',
      filename: 'hum-m1895-module.json',
    })
  })
})
