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

  it('serves an absent book as an empty passage', async () => {
    const passage = await setup().passage(ref('Genesis 1:1'), 'web')

    expect(passage).toMatchObject({ status: 'ok', verses: [] })
  })

  it('carries a copyright attribution from the manifest', async () => {
    const source = setup('New King James Version®, Copyright © 1982')

    const passage = await source.passage(ref('John 15:4'), 'web')

    expect(passage).toMatchObject({
      attribution: 'New King James Version®, Copyright © 1982',
    })
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
