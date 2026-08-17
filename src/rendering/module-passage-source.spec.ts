import { describe, expect, it } from 'vitest'
import type { ModuleManifest } from '../modules'
import { makeVerseId, parseReference, type Reference } from '../reference'
import { ModulePassageSource } from './module-passage-source'

const john = (chapter: number, verse: number) => makeVerseId(43, chapter, verse)

const webManifest = (license: string): ModuleManifest => ({
  id: 'web',
  name: 'World English Bible',
  language: 'English',
  license,
  source: 'https://api.getbible.net/v2/web.json',
  sourceChecksum: 'abc123',
  formatVersion: 1,
  capabilities: { strongsTagged: false },
})

const setup = (license = 'Public Domain') => {
  const books: Record<number, Record<number, string>> = {
    43: {
      [john(15, 4)]: 'Remain in me, and I in you.',
      [john(15, 5)]: 'I am the vine. You are the branches.',
      [john(15, 7)]: 'If you remain in me, ask whatever you desire.',
    },
  }
  return new ModulePassageSource({
    manifest: async (moduleId) =>
      moduleId === 'web' ? webManifest(license) : null,
    bookContent: async (moduleId, book) =>
      moduleId === 'web' ? (books[book] ?? null) : null,
  })
}

const ref = (text: string): Reference => {
  const parsed = parseReference(text)
  if (!parsed) throw new Error(`unparseable: ${text}`)
  return parsed.reference
}

describe('ModulePassageSource', () => {
  it('serves the verses of a reference in canonical order', async () => {
    const passage = await setup().passage(ref('John 15:5,4'), 'web')

    expect(passage).toEqual({
      status: 'ok',
      attribution: null,
      verses: [
        {
          verseId: john(15, 4),
          segments: [{ text: 'Remain in me, and I in you.', redLetter: false }],
        },
        {
          verseId: john(15, 5),
          segments: [
            { text: 'I am the vine. You are the branches.', redLetter: false },
          ],
        },
      ],
    })
  })

  it('skips content gaps silently', async () => {
    const passage = await setup().passage(ref('John 15:4-7'), 'web')

    expect(passage.status).toBe('ok')
    if (passage.status !== 'ok') return
    expect(passage.verses.map((verse) => verse.verseId)).toEqual([
      john(15, 4),
      john(15, 5),
      john(15, 7),
    ])
  })

  it('reports an uninstalled translation as unavailable', async () => {
    expect(await setup().passage(ref('John 15:4'), 'kjv')).toEqual({
      status: 'unavailable',
    })
  })

  it('reports an absent book as unavailable so retries can succeed', async () => {
    expect(await setup().passage(ref('Genesis 1:1'), 'web')).toEqual({
      status: 'unavailable',
    })
  })

  it('reports a reference whose verses are all content gaps as unavailable', async () => {
    expect(await setup().passage(ref('John 15:6'), 'web')).toEqual({
      status: 'unavailable',
    })
  })

  it('carries a copyright attribution from the manifest', async () => {
    const source = setup('New King James Version®, Copyright © 1982')

    const passage = await source.passage(ref('John 15:4'), 'web')

    expect(passage).toMatchObject({
      attribution: 'New King James Version®, Copyright © 1982',
    })
  })

  it('splits a Strong-tagged verse into segments carrying their tags', async () => {
    const source = new ModulePassageSource({
      manifest: async () => ({
        ...webManifest('Public Domain'),
        id: 'bsb',
        capabilities: { strongsTagged: true },
      }),
      bookContent: async () => ({
        [john(15, 4)]: {
          text: 'Remain in Me, and I in you.',
          tags: [
            { start: 0, end: 6, strongs: ['G3306'] },
            { start: 10, end: 12, strongs: ['G1473'] },
          ],
        },
      }),
    })

    const passage = await source.passage(ref('John 15:4'), 'bsb')

    expect(passage).toMatchObject({
      status: 'ok',
      verses: [
        {
          verseId: john(15, 4),
          segments: [
            { text: 'Remain', redLetter: false, strongs: ['G3306'] },
            { text: ' in ', redLetter: false },
            { text: 'Me', redLetter: false, strongs: ['G1473'] },
            { text: ', and I in you.', redLetter: false },
          ],
        },
      ],
    })
  })

  it('splits a lined verse into segments at its line starts', async () => {
    const source = new ModulePassageSource({
      manifest: async () => webManifest('Public Domain'),
      bookContent: async () => ({
        [makeVerseId(19, 23, 1)]: {
          text: 'The LORD is my shepherd, I lack nothing.',
          lines: [{ start: 0 }, { start: 25 }],
        },
      }),
    })

    const passage = await source.passage(ref('Psalms 23:1'), 'web')

    expect(passage).toMatchObject({
      status: 'ok',
      verses: [
        {
          verseId: makeVerseId(19, 23, 1),
          hasLineData: true,
          segments: [
            { text: 'The LORD is my shepherd, ', redLetter: false },
            { text: 'I lack nothing.', redLetter: false, lineBreakBefore: true },
          ],
        },
      ],
    })
  })

  it('carries indent and psalm-heading line properties onto segments', async () => {
    const source = new ModulePassageSource({
      manifest: async () => webManifest('Public Domain'),
      bookContent: async () => ({
        [makeVerseId(19, 23, 1)]: {
          text: 'A Psalm of David. The LORD is my shepherd; I shall not want.',
          lines: [
            { start: 0, psalmHeading: true },
            { start: 18, indent: 1 },
            { start: 43, indent: 2 },
          ],
        },
      }),
    })

    const passage = await source.passage(ref('Psalms 23:1'), 'web')

    expect(passage).toMatchObject({
      status: 'ok',
      verses: [
        {
          verseId: makeVerseId(19, 23, 1),
          hasLineData: true,
          segments: [
            {
              text: 'A Psalm of David. ',
              redLetter: false,
              lineStart: true,
              psalmHeading: true,
            },
            {
              text: 'The LORD is my shepherd; ',
              redLetter: false,
              lineStart: true,
              lineBreakBefore: true,
              indent: 1,
            },
            {
              text: 'I shall not want.',
              redLetter: false,
              lineStart: true,
              lineBreakBefore: true,
              indent: 2,
            },
          ],
        },
      ],
    })
  })

  it('copies line properties to every segment of the line but marks only its first segment as lineStart', async () => {
    const source = new ModulePassageSource({
      manifest: async () => webManifest('Public Domain'),
      bookContent: async () => ({
        [john(15, 4)]: {
          text: 'Remain in Me, and I in you.',
          tags: [{ start: 18, end: 19, strongs: ['G1473'] }],
          lines: [{ start: 0, indent: 1 }],
        },
      }),
    })

    const passage = await source.passage(ref('John 15:4'), 'web')

    expect(passage).toMatchObject({
      verses: [
        {
          segments: [
            { text: 'Remain in Me, and ', lineStart: true, indent: 1 },
            { text: 'I', strongs: ['G1473'], indent: 1 },
            { text: ' in you.', indent: 1 },
          ],
        },
      ],
    })
    const verse = (passage as { verses: { segments: unknown[] }[] }).verses[0]
    const [, second, third] = verse.segments as { lineStart?: boolean }[]
    expect(second.lineStart).toBeUndefined()
    expect(third.lineStart).toBeUndefined()
  })

  it('leaves segments before the first line start without line properties', async () => {
    const source = new ModulePassageSource({
      manifest: async () => webManifest('Public Domain'),
      bookContent: async () => ({
        [john(15, 4)]: {
          text: 'Remain in Me, and I in you.',
          lines: [{ start: 14, indent: 1 }],
        },
      }),
    })

    const passage = await source.passage(ref('John 15:4'), 'web')

    expect(passage).toMatchObject({
      verses: [
        {
          segments: [
            { text: 'Remain in Me, ', redLetter: false },
            {
              text: 'and I in you.',
              redLetter: false,
              lineStart: true,
              lineBreakBefore: true,
              indent: 1,
            },
          ],
        },
      ],
    })
    const [first] = (
      passage as {
        verses: { segments: { lineStart?: boolean; indent?: number }[] }[]
      }
    ).verses[0].segments
    expect(first.lineStart).toBeUndefined()
    expect(first.indent).toBeUndefined()
  })

  it('marks a verse whose first line starts a paragraph', async () => {
    const source = new ModulePassageSource({
      manifest: async () => webManifest('Public Domain'),
      bookContent: async () => ({
        [john(15, 1)]: {
          text: 'I am the true vine.',
          lines: [{ start: 0, paragraph: true }],
        },
        [john(15, 2)]: 'He cuts off every branch in Me.',
      }),
    })

    const passage = await source.passage(ref('John 15:1-2'), 'web')

    expect(passage).toMatchObject({
      verses: [
        { verseId: john(15, 1), startsParagraph: true },
        { verseId: john(15, 2) },
      ],
    })
    const second = (
      passage as { verses: { startsParagraph?: boolean }[] }
    ).verses[1]
    expect(second.startsParagraph).toBeUndefined()
  })

  it('does not mark a paragraph start on a mid-verse line', async () => {
    const source = new ModulePassageSource({
      manifest: async () => webManifest('Public Domain'),
      bookContent: async () => ({
        [john(15, 4)]: {
          text: 'Remain in Me, and I in you.',
          lines: [{ start: 14, paragraph: true }],
        },
      }),
    })

    const passage = await source.passage(ref('John 15:4'), 'web')

    const [verse] = (passage as { verses: { startsParagraph?: boolean }[] })
      .verses
    expect(verse.startsParagraph).toBeUndefined()
  })

  it('splits at both tag boundaries and line starts in a tagged lined verse', async () => {
    const source = new ModulePassageSource({
      manifest: async () => webManifest('Public Domain'),
      bookContent: async () => ({
        [john(15, 4)]: {
          text: 'Remain in Me, and I in you.',
          tags: [{ start: 0, end: 6, strongs: ['G3306'] }],
          lines: [{ start: 0 }, { start: 14 }],
        },
      }),
    })

    const passage = await source.passage(ref('John 15:4'), 'web')

    expect(passage).toMatchObject({
      verses: [
        {
          hasLineData: true,
          segments: [
            { text: 'Remain', redLetter: false, strongs: ['G3306'] },
            { text: ' in Me, ', redLetter: false },
            { text: 'and I in you.', redLetter: false, lineBreakBefore: true },
          ],
        },
      ],
    })
  })

  it('splits at red-letter boundaries and marks the covered segments', async () => {
    const source = new ModulePassageSource({
      manifest: async () => webManifest('Public Domain'),
      bookContent: async () => ({
        [john(15, 4)]: {
          text: 'He said, "Remain in Me, and I in you."',
          red: [{ start: 9, end: 38 }],
        },
      }),
    })

    const passage = await source.passage(ref('John 15:4'), 'web')

    expect(passage).toMatchObject({
      verses: [
        {
          segments: [
            { text: 'He said, ', redLetter: false },
            { text: '"Remain in Me, and I in you."', redLetter: true },
          ],
        },
      ],
    })
  })

  it('splits at supplied-word boundaries and marks the covered segments', async () => {
    const source = new ModulePassageSource({
      manifest: async () => webManifest('Public Domain'),
      bookContent: async () => ({
        [makeVerseId(40, 1, 1)]: {
          text: 'the book of the genealogy of Jesus',
          supplied: [{ start: 0, end: 3 }],
        },
      }),
    })

    const passage = await source.passage(ref('Matthew 1:1'), 'web')

    expect(passage).toMatchObject({
      verses: [
        {
          segments: [
            { text: 'the', redLetter: false, supplied: true },
            { text: ' book of the genealogy of Jesus', redLetter: false },
          ],
        },
      ],
    })
  })

  it('composes red-letter and supplied cuts with Strong-tag boundaries', async () => {
    const source = new ModulePassageSource({
      manifest: async () => webManifest('Public Domain'),
      bookContent: async () => ({
        [john(15, 4)]: {
          text: 'Remain in Me, and I in you.',
          tags: [{ start: 0, end: 6, strongs: ['G3306'] }],
          red: [{ start: 0, end: 13 }],
          supplied: [{ start: 10, end: 12 }],
        },
      }),
    })

    const passage = await source.passage(ref('John 15:4'), 'web')

    expect(passage).toMatchObject({
      verses: [
        {
          segments: [
            { text: 'Remain', redLetter: true, strongs: ['G3306'] },
            { text: ' in ', redLetter: true },
            { text: 'Me', redLetter: true, supplied: true },
            { text: ',', redLetter: true },
            { text: ' and I in you.', redLetter: false },
          ],
        },
      ],
    })
  })

  it('carries no line-data flag for verses without a line channel', async () => {
    const passage = await setup().passage(ref('John 15:4'), 'web')

    expect(passage.status).toBe('ok')
    if (passage.status !== 'ok') return
    expect(passage.verses[0].hasLineData).toBeUndefined()
  })

  it('shows no attribution for public domain or unlicensed modules', async () => {
    const publicDomain = await setup('Public Domain').passage(
      ref('John 15:4'),
      'web',
    )
    const empty = await setup('').passage(ref('John 15:4'), 'web')

    expect(publicDomain).toMatchObject({ attribution: null })
    expect(empty).toMatchObject({ attribution: null })
  })
})

describe('ModulePassageSource derived red letter', () => {
  const books: Record<number, Record<number, string>> = {
    40: { [makeVerseId(40, 4, 4)]: 'But Jesus answered, It is written.' },
    43: {
      [john(11, 35)]: 'Jesus wept.',
      [john(15, 4)]: 'Remain in me, and I in you.',
    },
  }

  const derivedSource = (
    enabled: boolean,
    manifestOverrides: Partial<ModuleManifest> = {},
  ) =>
    new ModulePassageSource(
      {
        manifest: async () => ({
          ...webManifest('Public Domain'),
          ...manifestOverrides,
        }),
        bookContent: async (_moduleId, book) => books[book] ?? null,
      },
      { derivedRedLetter: () => enabled },
    )

  it('renders a full-cue verse entirely red when the module has no native red letter', async () => {
    const passage = await derivedSource(true).passage(ref('John 15:4'), 'web')

    expect(passage).toMatchObject({
      verses: [
        {
          segments: [
            { text: 'Remain in me, and I in you.', redLetter: true },
          ],
        },
      ],
    })
  })

  it('renders a partial-cue verse entirely red at whole-verse granularity', async () => {
    const passage = await derivedSource(true).passage(
      ref('Matthew 4:4'),
      'web',
    )

    expect(passage).toMatchObject({
      verses: [
        {
          segments: [
            { text: 'But Jesus answered, It is written.', redLetter: true },
          ],
        },
      ],
    })
  })

  it('leaves an uncued verse plain', async () => {
    const passage = await derivedSource(true).passage(ref('John 11:35'), 'web')

    expect(passage).toMatchObject({
      verses: [{ segments: [{ text: 'Jesus wept.', redLetter: false }] }],
    })
  })

  it('derives nothing while the setting is off', async () => {
    const passage = await derivedSource(false).passage(ref('John 15:4'), 'web')

    expect(passage).toMatchObject({
      verses: [
        {
          segments: [
            { text: 'Remain in me, and I in you.', redLetter: false },
          ],
        },
      ],
    })
  })

  it('leaves a module with native red-letter data untouched', async () => {
    const source = new ModulePassageSource(
      {
        manifest: async () => ({
          ...webManifest('Public Domain'),
          id: 'bsb',
          capabilities: { strongsTagged: true, redLetter: true },
        }),
        bookContent: async () => ({
          [john(15, 4)]: {
            text: 'He said, Remain in me, and I in you.',
            red: [{ start: 9, end: 36 }],
          },
        }),
      },
      { derivedRedLetter: () => true },
    )

    const passage = await source.passage(ref('John 15:4'), 'bsb')

    expect(passage).toMatchObject({
      verses: [
        {
          segments: [
            { text: 'He said, ', redLetter: false },
            { text: 'Remain in me, and I in you.', redLetter: true },
          ],
        },
      ],
    })
  })
})
