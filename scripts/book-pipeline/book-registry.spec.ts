import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  type BookRegistryEntry,
  assertRegisteredBook,
  bookPublication,
  parseBookRegistry,
} from './book-registry'

const humility: BookRegistryEntry = {
  bookNumber: 101,
  title: 'Humility',
  author: 'Andrew Murray',
  moduleId: 'hum-m1895',
  editionCode: 'HUM-M1895',
}

const registryJson = (entries: unknown) => JSON.stringify(entries)

describe('parseBookRegistry', () => {
  it('reads the append-only list of registered books', () => {
    expect(parseBookRegistry(registryJson([humility]))).toEqual([humility])
  })

  it('rejects a reused book number', () => {
    const clash = { ...humility, moduleId: 'oth-m1900', editionCode: 'OTH' }
    expect(() => parseBookRegistry(registryJson([humility, clash]))).toThrow(
      /book number 101/i,
    )
  })

  it('rejects a reused module id', () => {
    const clash = { ...humility, bookNumber: 102, editionCode: 'OTH' }
    expect(() => parseBookRegistry(registryJson([humility, clash]))).toThrow(
      /module id hum-m1895/i,
    )
  })

  it('rejects a reused edition code', () => {
    const clash = { ...humility, bookNumber: 102, moduleId: 'oth-m1900' }
    expect(() => parseBookRegistry(registryJson([humility, clash]))).toThrow(
      /edition code HUM-M1895/i,
    )
  })

  it('rejects a book number inside the scripture and reserved ranges', () => {
    expect(() =>
      parseBookRegistry(registryJson([{ ...humility, bookNumber: 66 }])),
    ).toThrow(/101/)
  })

  it('rejects an entry missing a required field', () => {
    const { author: _author, ...incomplete } = humility
    expect(() => parseBookRegistry(registryJson([incomplete]))).toThrow(
      /author/i,
    )
  })

  it('rejects a registry that is not a list', () => {
    expect(() => parseBookRegistry(registryJson(humility))).toThrow(/list/i)
  })
})

describe('assertRegisteredBook', () => {
  const registry = [humility]

  it('accepts a registration matching its registry entry', () => {
    expect(() => assertRegisteredBook(humility, registry)).not.toThrow()
  })

  it('fails when the module id is unregistered', () => {
    expect(() =>
      assertRegisteredBook({ ...humility, moduleId: 'unknown' }, registry),
    ).toThrow(/unknown/)
  })

  it.each([
    ['bookNumber', { bookNumber: 102 }],
    ['title', { title: 'Humility: The Beauty of Holiness' }],
    ['author', { author: 'A. Murray' }],
    ['editionCode', { editionCode: 'HUM-1895' }],
  ])('fails when %s disagrees with the registry', (field, override) => {
    expect(() =>
      assertRegisteredBook({ ...humility, ...override }, registry),
    ).toThrow(new RegExp(field, 'i'))
  })
})

describe('bookPublication', () => {
  const inBook: BookRegistryEntry = {
    bookNumber: 102,
    title: 'IN',
    author: 'A Team',
    moduleId: 'in-at-e1',
    editionCode: 'IN-AT-E1',
    year: 2026,
    abbreviation: 'IN',
    aliases: ['In'],
    license: 'No rights reserved.',
    source: 'IN First Edition.pdf',
    sourceChecksum: 'adb9dc5b',
  }

  it('answers with the entry a module can be published from', () => {
    expect(bookPublication([humility, inBook], 'in-at-e1')).toEqual(inBook)
  })

  it('fails when the module has no registry entry at all', () => {
    expect(() => bookPublication([humility], 'in-at-e1')).toThrow(
      /in-at-e1 is not in the Book Registry/,
    )
  })

  it.each(['year', 'abbreviation', 'aliases', 'license', 'source', 'sourceChecksum'])(
    'fails when the entry carries no %s to publish with',
    (field) => {
      const { [field as keyof BookRegistryEntry]: _missing, ...thin } = inBook
      expect(() => bookPublication([thin], 'in-at-e1')).toThrow(
        new RegExp(`missing "${field}"`),
      )
    },
  )
})

describe('scripts/book-registry.json', () => {
  const registry = parseBookRegistry(
    readFileSync('scripts/book-registry.json', 'utf8'),
  )

  it('registers Humility as book 101', () => {
    expect(registry).toContainEqual(humility)
  })

  it('registers IN as book 102, complete enough to publish', () => {
    expect(bookPublication(registry, 'in-at-e1')).toMatchObject({
      bookNumber: 102,
      title: 'IN',
      author: 'A Team',
      editionCode: 'IN-AT-E1',
      year: 2026,
      abbreviation: 'IN',
      aliases: ['In'],
    })
  })
})
