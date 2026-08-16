import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../../src/reference/verse-id'
import type { TaggedVerse } from '../../src/modules/verse-content'
import { parseBsbTables } from './parse-bsb-tables'

const fixture = readFileSync('tests/fixtures/bsb-tables-slice.tsv', 'utf8')

const verses = parseBsbTables(fixture)

const verse = (book: number, chapter: number, verseNr: number): TaggedVerse => {
  const content = verses.get(book)?.[makeVerseId(book, chapter, verseNr)]
  if (content === undefined) throw new Error('verse missing from parse result')
  return content
}

const tagged = (taggedVerse: TaggedVerse, span: number): string =>
  taggedVerse.text.slice(taggedVerse.tags[span].start, taggedVerse.tags[span].end)

describe('parseBsbTables verse text', () => {
  it('assembles Genesis 1:1 from word rows with attached punctuation', () => {
    expect(verse(1, 1, 1).text).toBe(
      'In the beginning God created the heavens and the earth.',
    )
  })
})

describe('parseBsbTables verse text edge cases', () => {
  it('keeps multiple sentences of one verse together', () => {
    expect(verse(1, 1, 2).text).toBe(
      'Now the earth was formless and void, and darkness was over the surface ' +
        'of the deep. And the Spirit of God was hovering over the surface of the waters.',
    )
  })

  it('drops footnote markers hidden in quote columns', () => {
    expect(verse(19, 23, 1).text).toBe(
      'A Psalm of David. The LORD is my shepherd; I shall not want.',
    )
  })

  it('unwraps bracketed supplied words', () => {
    expect(verse(40, 1, 1).text).toBe(
      'This is the record of the genealogy of Jesus Christ, the son of David, ' +
        'the son of Abraham:',
    )
  })

  it('skips untranslated placeholder words and keeps closing quotes', () => {
    expect(verse(39, 4, 6).text).toBe(
      'And he will turn the hearts of the fathers to their children, and the ' +
        'hearts of the children to their fathers. Otherwise, I will come and ' +
        'strike the land with a curse.”',
    )
  })

  it('unwraps curly-brace supplied words', () => {
    expect(verse(43, 15, 4).text).toBe(
      'Remain in Me, and I will remain in you. Just as no branch can bear ' +
        'fruit by itself unless it remains in the vine, neither can you bear ' +
        'fruit unless you remain in Me.',
    )
  })

  it('keeps parentheses attached when their word is an untranslated placeholder', () => {
    expect(verse(42, 9, 14).text).toBe(
      '(There were about five thousand men.) He told His disciples, ' +
        '“Have them sit down in groups of about fifty each.',
    )
  })

  it('assembles a red-letter Greek verse without vvv placeholders', () => {
    expect(verse(43, 3, 16).text).toBe(
      'For God so loved the world that He gave His one and only Son, that ' +
        'everyone who believes in Him shall not perish but have eternal life.',
    )
  })
})

describe('parseBsbTables tag spans', () => {
  it('maps each translated word to its Strong Hebrew number', () => {
    const genesis11 = verse(1, 1, 1)
    expect(genesis11.tags).toHaveLength(6)
    expect(tagged(genesis11, 0)).toBe('In the beginning')
    expect(genesis11.tags[0].strongs).toEqual(['H7225'])
    expect(tagged(genesis11, 1)).toBe('God')
    expect(genesis11.tags[1].strongs).toEqual(['H0430'])
    expect(tagged(genesis11, 5)).toBe('the earth')
    expect(genesis11.tags[5].strongs).toEqual(['H0776'])
  })

  it('maps Greek words to padded G-numbers excluding punctuation', () => {
    const matthew11 = verse(40, 1, 1)
    expect(tagged(matthew11, 0)).toBe('This is the record')
    expect(matthew11.tags[0].strongs).toEqual(['G0976'])
    expect(tagged(matthew11, 3)).toBe('Christ')
    expect(matthew11.tags[3].strongs).toEqual(['G5547'])
  })

  it('excludes untranslated placeholder rows from the tag list', () => {
    const john316 = verse(43, 3, 16)
    const spans = john316.tags.map((_, index) => tagged(john316, index))
    expect(spans).not.toContain('-')
    expect(spans).not.toContain('vvv')
    expect(spans[0]).toBe('For')
    expect(john316.tags[0].strongs).toEqual(['G1063'])
  })
})

describe('parseBsbTables book handling', () => {
  it('groups verses under their book numbers across testaments', () => {
    expect([...verses.keys()].sort((a, b) => a - b)).toEqual([
      1, 19, 39, 40, 42, 43,
    ])
  })
})
