import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import { MODULE_FORMAT_VERSION } from './module-manifest'
import { normalizeBollsTranslation } from './normalize-bolls-translation'
import type { BollsVerse } from './normalize-bolls-translation'
import type { TaggedVerse } from './verse-content'

const nkjvSlice = (): BollsVerse[] =>
  JSON.parse(
    readFileSync('tests/fixtures/bolls-nkjv-slice.json', 'utf8'),
  ) as BollsVerse[]

const nkjvMeta = { name: 'New King James Version, 1982', language: 'English' }

const sourceInfo = {
  source: 'https://bolls.life/static/translations/NKJV.json',
  sourceChecksum: 'abc123',
}

describe('normalizeBollsTranslation with plain texts', () => {
  it('keys each verse text by canonical verse id within its book', () => {
    const normalized = normalizeBollsTranslation(
      'nkjv',
      nkjvSlice(),
      nkjvMeta,
      sourceInfo,
    )

    expect(normalized.books.get(1)?.[makeVerseId(1, 1, 1)]).toBe(
      'In the beginning God created the heavens and the earth.',
    )
    expect(normalized.books.get(43)?.[makeVerseId(43, 15, 4)]).toBe(
      'Abide in Me, and I in you. As the branch cannot bear fruit of itself, unless it abides in the vine, neither can you, unless you abide in Me.',
    )
  })

  it('builds the module manifest from catalogue metadata and source info, untagged', () => {
    const normalized = normalizeBollsTranslation(
      'nkjv',
      nkjvSlice(),
      nkjvMeta,
      sourceInfo,
    )

    expect(normalized.manifest).toEqual({
      id: 'nkjv',
      name: 'New King James Version, 1982',
      language: 'English',
      license: '',
      source: 'https://bolls.life/static/translations/NKJV.json',
      sourceChecksum: 'abc123',
      formatVersion: MODULE_FORMAT_VERSION,
      capabilities: { strongsTagged: false },
    })
  })

  it('strips styling markup and collapses whitespace, dropping comment cross-refs', () => {
    const normalized = normalizeBollsTranslation(
      'nkjv',
      nkjvSlice(),
      nkjvMeta,
      sourceInfo,
    )

    // Source text: '“I am the vine, you <i>are</i> the branches. He who abides
    // in Me, and I in him, bears much  fruit; ...' plus a comment field of
    // <a> cross-references that must not survive normalization.
    expect(normalized.books.get(43)?.[makeVerseId(43, 15, 5)]).toBe(
      '“I am the vine, you are the branches. He who abides in Me, and I in him, bears much fruit; for without Me you can do nothing.',
    )
  })

  it('drops verses outside the canonical grid or aliasing other grid positions', () => {
    const verses: BollsVerse[] = [
      ...nkjvSlice(),
      { book: 67, chapter: 1, verse: 1, text: 'Apocryphal.' },
      { book: 43, chapter: 15, verse: 999, text: 'Beyond the grid.' },
      { book: 43, chapter: 15, verse: 1004, text: 'Would alias John 16:4.' },
      { book: 43, chapter: 1015, verse: 4, text: 'Would alias Acts 15:4.' },
      { book: 43, chapter: -1, verse: 4, text: 'Negative chapter.' },
      { book: 43, chapter: 15, verse: 4.5, text: 'Fractional.' },
    ]

    const normalized = normalizeBollsTranslation(
      'nkjv',
      verses,
      nkjvMeta,
      sourceInfo,
    )

    expect(normalized.books.has(67)).toBe(false)
    expect(normalized.books.get(43)?.[makeVerseId(43, 15, 999)]).toBeUndefined()
    expect(normalized.books.get(43)?.[makeVerseId(43, 16, 4)]).toBeUndefined()
    expect(normalized.books.get(43)?.[makeVerseId(44, 15, 4)]).toBeUndefined()
    expect(normalized.books.get(43)?.[makeVerseId(43, 15, 4)]).toBeDefined()
  })
})

describe('normalizeBollsTranslation with <br/> line breaks', () => {
  const psalmVerse = (text: string): BollsVerse => ({
    book: 19,
    chapter: 23,
    verse: 1,
    text,
  })

  const normalizedContent = (text: string) =>
    normalizeBollsTranslation('niv', [psalmVerse(text)], nkjvMeta, sourceInfo)
      .books.get(19)?.[makeVerseId(19, 23, 1)]

  it('converts internal <br/> tags into the verse line channel', () => {
    expect(
      normalizedContent('The LORD is my shepherd,<br/>I lack nothing.'),
    ).toEqual({
      text: 'The LORD is my shepherd, I lack nothing.',
      lines: [{ start: 0 }, { start: 25 }],
    })
  })

  it('accepts unclosed <br> tags and collapses whitespace around breaks', () => {
    expect(
      normalizedContent('He makes me lie down <br>  <br /> he leads me.'),
    ).toEqual({
      text: 'He makes me lie down he leads me.',
      lines: [{ start: 0 }, { start: 21 }],
    })
  })

  it('keeps a verse with only leading or trailing breaks as plain text', () => {
    expect(normalizedContent('<br/>He restores my soul.<br/>')).toBe(
      'He restores my soul.',
    )
  })

  it('keeps verses without breaks as plain strings exactly as before', () => {
    expect(normalizedContent('He restores my soul.')).toBe(
      'He restores my soul.',
    )
  })

  it('drops breaks inside footnote <sup> blocks with the footnote', () => {
    expect(
      normalizedContent('Surely goodness<sup>note<br/>more</sup> follows me.'),
    ).toBe('Surely goodness follows me.')
  })

  it('treats <br/> in Strong-tagged verses as plain whitespace', () => {
    const verses: BollsVerse[] = [
      {
        book: 43,
        chapter: 15,
        verse: 4,
        text: 'Abide<S>3306</S> in me,<br/>and I in you.',
      },
    ]

    const content = normalizeBollsTranslation(
      'kjv',
      verses,
      nkjvMeta,
      sourceInfo,
    ).books.get(43)?.[makeVerseId(43, 15, 4)]

    expect(content).toEqual({
      text: 'Abide in me, and I in you.',
      tags: [{ start: 0, end: 5, strongs: ['G3306'] }],
    })
  })
})

const kjvSlice = (): BollsVerse[] =>
  JSON.parse(
    readFileSync('tests/fixtures/bolls-kjv-slice.json', 'utf8'),
  ) as BollsVerse[]

const kjvMeta = {
  name: "King James Version 1769 with Apocrypha and Strong's Numbers",
  language: 'English',
}

const kjvSource = {
  source: 'https://bolls.life/static/translations/KJV.json',
  sourceChecksum: 'def456',
}

const normalizedKjv = () =>
  normalizeBollsTranslation('kjv', kjvSlice(), kjvMeta, kjvSource)

const kjvVerse = (book: number, chapter: number, verse: number): TaggedVerse => {
  const content = normalizedKjv().books.get(book)?.[
    makeVerseId(book, chapter, verse)
  ]
  if (
    content === undefined ||
    typeof content === 'string' ||
    content.tags === undefined
  )
    throw new Error('expected a tagged verse')
  return { ...content, tags: content.tags }
}

const taggedWord = (verse: TaggedVerse, span: number): string =>
  verse.text.slice(verse.tags[span].start, verse.tags[span].end)

describe('normalizeBollsTranslation with <S>-tagged texts', () => {
  it('sets the strongsTagged manifest capability', () => {
    expect(normalizedKjv().manifest.capabilities).toEqual({
      strongsTagged: true,
    })
  })

  it('converts trailing <S> tags into word spans with testament-prefixed numbers', () => {
    const genesis11 = kjvVerse(1, 1, 1)

    expect(genesis11.text).toBe(
      'In the beginning God created the heaven and the earth.',
    )
    expect(taggedWord(genesis11, 0)).toBe('beginning')
    expect(genesis11.tags[0].strongs).toEqual(['H7225'])
    expect(taggedWord(genesis11, 1)).toBe('God')
    expect(genesis11.tags[1].strongs).toEqual(['H0430'])
  })

  it('folds a standalone tag into the preceding word span', () => {
    // '...created<S>1254</S> <S>853</S> the heaven...' — the untranslated
    // object marker 853 rides on 'created'.
    const genesis11 = kjvVerse(1, 1, 1)

    expect(taggedWord(genesis11, 2)).toBe('created')
    expect(genesis11.tags[2].strongs).toEqual(['H1254', 'H0853'])
  })

  it('prefixes New Testament tags with G and keeps spans on the words', () => {
    const john154 = kjvVerse(43, 15, 4)

    expect(john154.text).toBe(
      'Abide in me, and I in you. As the branch cannot bear fruit of itself, except it abide in the vine; no more can ye, except ye abide in me.',
    )
    expect(taggedWord(john154, 0)).toBe('Abide')
    expect(john154.tags[0].strongs).toEqual(['G3306'])
    expect(taggedWord(john154, 8)).toBe('cannot')
    expect(john154.tags[8].strongs).toEqual(['G3756', 'G1410'])
  })

  it('drops footnote <sup> blocks together with their tags', () => {
    // Gen 1:4 carries '<sup>the light from: Heb. between...</sup>';
    // 2 Cor 13:14 carries a tagged subscription inside <sup>.
    expect(kjvVerse(1, 1, 4).text).toBe(
      'And God saw the light, that it was good: and God divided the light from the darkness.',
    )

    const corinthians = kjvVerse(47, 13, 14)
    expect(corinthians.text).toBe(
      'The grace of the Lord Jesus Christ, and the love of God, and the communion of the Holy Ghost, be with you all. Amen.',
    )
    expect(corinthians.tags[corinthians.tags.length - 1].strongs).toEqual([
      'G0281',
    ])
  })

  it('strips styling markup while keeping its words and spans intact', () => {
    // 1 Tim 5:18 wraps the quotation in <b>...</b>.
    const timothy = kjvVerse(54, 5, 18)

    expect(timothy.text).toContain('Thou shalt not muzzle the ox')
    const muzzleSpan = timothy.tags.find((tag) =>
      tag.strongs.includes('G1016'),
    )
    expect(muzzleSpan).toBeDefined()
    if (muzzleSpan)
      expect(timothy.text.slice(muzzleSpan.start, muzzleSpan.end)).toBe('ox')
  })

  it('keeps untagged apocryphal books out while tagging canonical ones', () => {
    expect(normalizedKjv().books.has(67)).toBe(false)
  })
})

const verseContent = (text: string) => {
  const normalized = normalizeBollsTranslation(
    'kjv',
    [{ book: 43, chapter: 15, verse: 4, text }],
    kjvMeta,
    kjvSource,
  )
  const content = normalized.books.get(43)?.[makeVerseId(43, 15, 4)]
  if (content === undefined) throw new Error('expected verse content')
  return content
}

const tagVerse = (text: string): TaggedVerse => {
  const content = verseContent(text)
  if (typeof content === 'string' || content.tags === undefined)
    throw new Error('expected a tagged verse')
  return { ...content, tags: content.tags }
}

describe('taggedVerse edge cases', () => {
  it('keeps the word separator when a standalone tag precedes the next word', () => {
    const verse = tagVerse('Abide<S>3306</S> <S>853</S>in me.')

    expect(verse.text).toBe('Abide in me.')
    expect(verse.tags).toEqual([{ start: 0, end: 5, strongs: ['G3306', 'G0853'] }])
  })

  it('folds a standalone tag onto the preceding word span past its punctuation', () => {
    const verse = tagVerse('the light<S>216</S>, <S>853</S> that it was good.')

    expect(verse.text).toBe('the light, that it was good.')
    expect(verse.tags).toEqual([{ start: 4, end: 9, strongs: ['G0216', 'G0853'] }])
  })

  it('folds a standalone tag onto a preceding word that had no tag yet', () => {
    const verse = tagVerse('Abide <S>853</S> in me.')

    expect(verse.text).toBe('Abide in me.')
    expect(verse.tags).toEqual([{ start: 0, end: 5, strongs: ['G0853'] }])
  })

  it('drops a standalone tag at verse start with no preceding word', () => {
    const verse = tagVerse('<S>853</S> Abide in me.')

    expect(verse.text).toBe('Abide in me.')
    expect(verse.tags).toEqual([])
  })

  it('stacks adjacent tags onto a single span instead of duplicating it', () => {
    const verse = tagVerse('the branch cannot<S>3756</S><S>1410</S> bear fruit.')

    expect(verse.text).toBe('the branch cannot bear fruit.')
    expect(verse.tags).toEqual([
      { start: 11, end: 17, strongs: ['G3756', 'G1410'] },
    ])
  })
})

describe('malformed markup never reaches storage', () => {
  it('drops a malformed multi-number tag from an otherwise untagged verse', () => {
    expect(verseContent('word<S>3756 1410</S> more.')).toBe('word more.')
  })

  it('drops a malformed tag alongside valid ones without leaking its text', () => {
    const verse = tagVerse('Abide<S>3306</S> <S>3756 1410</S>in me.')

    expect(verse.text).toBe('Abide in me.')
    expect(verse.tags).toEqual([{ start: 0, end: 5, strongs: ['G3306'] }])
  })

  it('keeps words separated when a malformed tag sits between them', () => {
    const verse = tagVerse('Abide<S>3306</S> foo<S>x</S>bar and foo<S></S>bar.')

    expect(verse.text).toBe('Abide foo bar and foo bar.')
    expect(verse.tags).toEqual([{ start: 0, end: 5, strongs: ['G3306'] }])
  })

  it('strips stray unpaired S tags from the text', () => {
    const verse = tagVerse('Abide<S>3306</S> in </S> me <S> now.')

    expect(verse.text).toBe('Abide in me now.')
    expect(verse.tags).toEqual([{ start: 0, end: 5, strongs: ['G3306'] }])
  })

  it('drops an unclosed sup footnote to the end of the verse', () => {
    const verse = tagVerse('Abide<S>3306</S> in me.<sup>leaking footnote')

    expect(verse.text).toBe('Abide in me.')
    expect(verseContent('Abide in me.<sup>leaking footnote')).toBe(
      'Abide in me.',
    )
  })
})

describe('the concordance index a tagged translation carries', () => {
  it('maps each tagged family to the sorted verse ids it is tagged in', () => {
    const concordance = normalizedKjv().concordance ?? {}

    expect(concordance['H0430']).toEqual([
      makeVerseId(1, 1, 1),
      makeVerseId(1, 1, 4),
    ])
    expect(concordance['G3306']).toEqual([makeVerseId(43, 15, 4)])
  })

  it('indexes every number a single word span stacks', () => {
    const concordance = normalizedKjv().concordance ?? {}

    // Gen 1:1 stacks 'created' with the untranslated object marker H0853.
    expect(concordance['H1254']).toEqual([makeVerseId(1, 1, 1)])
    expect(concordance['H0853']).toContain(makeVerseId(1, 1, 1))
  })

  it('leaves a translation with no tags without an index at all', () => {
    const normalized = normalizeBollsTranslation(
      'nkjv',
      nkjvSlice(),
      nkjvMeta,
      sourceInfo,
    )

    expect(normalized.concordance).toBeUndefined()
  })
})
