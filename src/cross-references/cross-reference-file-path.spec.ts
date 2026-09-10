import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  HUMILITY_BOOK,
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import { ref } from '../../tests/fixtures/reference'
import { makeVerseId, type Reference } from '../reference'
import { crossReferenceFilePath } from './cross-reference-file-path'

const atom = (book: number, chapter: number, verse: number): Reference => ({
  book,
  ranges: [
    {
      startId: makeVerseId(book, chapter, verse),
      endId: makeVerseId(book, chapter, verse),
    },
  ],
})

const never = (): boolean => false

describe('crossReferenceFilePath', () => {
  it('joins the first two members with a plus, colons as periods', () => {
    expect(
      crossReferenceFilePath(
        'Cross-References',
        [ref('John 15:1-8'), ref('Psalm 80:8-16')],
        never,
      ),
    ).toBe('Cross-References/John 15.1-8 + Psalms 80.8-16.md')
  })

  it('counts the members beyond the first two', () => {
    expect(
      crossReferenceFilePath(
        'Cross-References',
        [ref('John 15:1-8'), ref('Psalm 80:8-16'), ref('Romans 11:17-24'), ref('Isaiah 5:1-7')],
        never,
      ),
    ).toBe('Cross-References/John 15.1-8 + Psalms 80.8-16 (+2).md')
  })

  it('suffixes colliding names with 1, 2, …', () => {
    const taken = new Set([
      'Cross-References/John 15.1 + Psalms 80.8.md',
      'Cross-References/John 15.1 + Psalms 80.8 1.md',
    ])

    expect(
      crossReferenceFilePath(
        'Cross-References',
        [ref('John 15:1'), ref('Psalm 80:8')],
        (path) => taken.has(path),
      ),
    ).toBe('Cross-References/John 15.1 + Psalms 80.8 2.md')
  })

  describe('with a Book member', () => {
    beforeEach(installHumilityBook)
    afterEach(uninstallHumilityBook)

    it('names the Book member by its citation label', () => {
      expect(
        crossReferenceFilePath(
          'Cross-References',
          [ref('John 15:5'), atom(HUMILITY_BOOK, 1, 2)],
          never,
        ),
      ).toBe('Cross-References/John 15.5 + Humility ch. 1, par. 2.md')
    })
  })
})
