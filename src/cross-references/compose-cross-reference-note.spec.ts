import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ENOCH_BOOK,
  installEnochBook,
  uninstallEnochBook,
} from '../../tests/fixtures/enoch-book'
import {
  HUMILITY_BOOK,
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import { makeVerseId, parseReference, type Reference } from '../reference'
import { composeCrossReferenceNote } from './compose-cross-reference-note'

const ref = (text: string): Reference => {
  const parsed = parseReference(text)
  if (parsed === null) throw new Error(`unparseable reference: ${text}`)
  return parsed.reference
}

const span = (
  book: number,
  [fromChapter, fromVerse]: [number, number],
  [toChapter, toVerse]: [number, number] = [fromChapter, fromVerse],
): Reference => ({
  book,
  ranges: [
    {
      startId: makeVerseId(book, fromChapter, fromVerse),
      endId: makeVerseId(book, toChapter, toVerse),
    },
  ],
})

const vine = [ref('John 15:1-8'), ref('Psalm 80:8-16')]

describe('composeCrossReferenceNote', () => {
  it('writes the three keys and an empty body without a template', () => {
    expect(composeCrossReferenceNote(vine, 'Vine imagery', null)).toBe(
      '---\ntype: cross-reference\nrefs:\n  - John 15:1-8\n  - Psalms 80:8-16\nsummary: Vine imagery\n---\n\n',
    )
  })

  it('writes an empty summary when none was given', () => {
    expect(composeCrossReferenceNote(vine, null, null)).toBe(
      '---\ntype: cross-reference\nrefs:\n  - John 15:1-8\n  - Psalms 80:8-16\nsummary: ""\n---\n\n',
    )
  })

  it('writes members in canonical grammar form, whatever they were typed as', () => {
    expect(composeCrossReferenceNote([ref('jhn 15:4'), ref('ps 80:8')], null, null)).toContain(
      'refs:\n  - John 15:4\n  - Psalms 80:8\n',
    )
  })

  it('quotes a summary YAML would otherwise misread', () => {
    expect(
      composeCrossReferenceNote(vine, 'Vine: Israel #1 "the true vine"', null),
    ).toContain('summary: "Vine: Israel #1 \\"the true vine\\""\n')
  })

  it('quotes a summary YAML would read as a number or boolean', () => {
    expect(composeCrossReferenceNote(vine, '1912', null)).toContain('summary: "1912"\n')
    expect(composeCrossReferenceNote(vine, 'yes', null)).toContain('summary: "yes"\n')
  })

  it('copies a frontmatter-less template as the body', () => {
    expect(
      composeCrossReferenceNote(vine, 'Vine imagery', '## Why\n\n## Notes\n'),
    ).toBe(
      '---\ntype: cross-reference\nrefs:\n  - John 15:1-8\n  - Psalms 80:8-16\nsummary: Vine imagery\n---\n## Why\n\n## Notes\n',
    )
  })

  it('adds the three keys to template frontmatter that lacks them', () => {
    expect(
      composeCrossReferenceNote(vine, 'Vine imagery', '---\ntags: study\n---\nBody\n'),
    ).toBe(
      '---\ntags: study\ntype: cross-reference\nrefs:\n  - John 15:1-8\n  - Psalms 80:8-16\nsummary: Vine imagery\n---\nBody\n',
    )
  })

  it('overwrites the keys the template already carries, in place', () => {
    expect(
      composeCrossReferenceNote(
        vine,
        'Vine imagery',
        '---\ntype: note\nrefs:\n  - Genesis 1:1\n  - Exodus 2:2\ntags: study\nsummary: old\n---\nBody\n',
      ),
    ).toBe(
      '---\ntype: cross-reference\nrefs:\n  - John 15:1-8\n  - Psalms 80:8-16\ntags: study\nsummary: Vine imagery\n---\nBody\n',
    )
  })

  it('replaces an inline refs list the template carries', () => {
    expect(
      composeCrossReferenceNote(vine, null, '---\nrefs: [Genesis 1:1]\ntags: study\n---\n'),
    ).toBe(
      '---\nrefs:\n  - John 15:1-8\n  - Psalms 80:8-16\ntags: study\ntype: cross-reference\nsummary: ""\n---\n',
    )
  })

  describe('Book members', () => {
    beforeEach(() => {
      installHumilityBook()
      installEnochBook()
    })
    afterEach(() => {
      uninstallHumilityBook()
      uninstallEnochBook()
    })

    it('writes paragraph and verse-atom Books in grammar form that parses back', () => {
      const members = [
        span(HUMILITY_BOOK, [1, 2]),
        span(ENOCH_BOOK, [1, 9], [1, 11]),
      ]

      const content = composeCrossReferenceNote(members, null, null)

      expect(content).toContain('refs:\n  - Humility 1:2\n  - 1 Enoch 1:9-11\n')
      for (const line of ['Humility 1:2', '1 Enoch 1:9-11']) {
        expect(parseReference(line)?.reference).toEqual(
          members[line.startsWith('Humility') ? 0 : 1],
        )
      }
    })
  })
})
