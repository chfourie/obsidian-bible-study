import { describe, expect, it } from 'vitest'
import { ApiBibleClient } from '../modules/api-bible-client'
import type { ModuleDataDir } from '../modules/module-data-dir'
import { PassageCache } from '../modules/passage-cache'
import { makeVerseId, type Reference } from '../reference'
import {
  ONLINE_FETCH_VERSE_LIMIT,
  OnlinePassageSource,
} from './online-passage-source'

const NKJV_BIBLE_ID = '63097d2a0a2f7db3-01'

const PASSAGE_QUERY =
  'content-type=json&include-notes=false&include-titles=false' +
  '&include-chapter-numbers=false&include-verse-numbers=false'

const passageUrl = (passageId: string): string =>
  `https://api.scripture.api.bible/v1/bibles/${NKJV_BIBLE_ID}/passages/${passageId}?${PASSAGE_QUERY}`

class FakeModuleDataDir implements ModuleDataDir {
  readonly files = new Map<string, string>()

  async readTextFile(path: string): Promise<string | null> {
    return this.files.get(path) ?? null
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    this.files.set(path, content)
  }

  async removeDir(path: string): Promise<void> {
    for (const file of [...this.files.keys()]) {
      if (file.startsWith(`${path}/`)) this.files.delete(file)
    }
  }

  async listDirs(): Promise<string[]> {
    return []
  }
}

const JOHN_15_4 = makeVerseId(43, 15, 4)
const JOHN_15_5 = makeVerseId(43, 15, 5)

const john15_4to5: Reference = {
  book: 43,
  ranges: [{ startId: JOHN_15_4, endId: JOHN_15_5 }],
}

const passageResponse = JSON.stringify({
  data: {
    content: [
      {
        name: 'para',
        type: 'tag',
        attrs: { style: 'p' },
        items: [
          {
            type: 'text',
            text: 'Abide in Me, and I in you.',
            attrs: { verseId: 'JHN.15.4' },
          },
          {
            type: 'text',
            text: 'I am the vine, you are the branches.',
            attrs: { verseId: 'JHN.15.5' },
          },
        ],
      },
    ],
    copyright: 'Copyright © 1982 Thomas Nelson',
    verseCount: 2,
  },
  meta: { fumsToken: 'fums-token-1' },
})

const setup = (options?: {
  apiKey?: string | null
  responses?: Record<string, string>
  dataDir?: FakeModuleDataDir
}) => {
  const calls: string[] = []
  const fumsTokens: string[] = []
  const responses = options?.responses ?? {
    [passageUrl('JHN.15.4-JHN.15.5')]: passageResponse,
  }
  const transport = async (url: string): Promise<string> => {
    calls.push(url)
    const response = responses[url]
    if (response === undefined) throw new Error(`no response for ${url}`)
    return response
  }
  const dataDir = options?.dataDir ?? new FakeModuleDataDir()
  const cache = new PassageCache(dataDir, () => 1_000_000)
  const source = new OnlinePassageSource({
    client: new ApiBibleClient(
      () => (options?.apiKey === undefined ? 'secret-key' : options.apiKey),
      transport,
    ),
    cache,
    reportFums: (token) => fumsTokens.push(token),
    apiBibleIdFor: (translationId) =>
      translationId === 'nkjv' ? NKJV_BIBLE_ID : null,
  })
  return { source, cache, calls, fumsTokens, dataDir }
}

describe('OnlinePassageSource', () => {
  it('serves a fetched passage with the publisher copyright as attribution', async () => {
    const { source } = setup()

    const passage = await source.passage(john15_4to5, 'nkjv')

    expect(passage).toEqual({
      status: 'ok',
      verses: [
        {
          verseId: JOHN_15_4,
          segments: [{ text: 'Abide in Me, and I in you.', redLetter: false }],
        },
        {
          verseId: JOHN_15_5,
          segments: [
            { text: 'I am the vine, you are the branches.', redLetter: false },
          ],
        },
      ],
      attribution: 'Copyright © 1982 Thomas Nelson',
    })
  })

  it('reports every FUMS token of a fetch', async () => {
    const { source, fumsTokens } = setup()

    await source.passage(john15_4to5, 'nkjv')

    expect(fumsTokens).toEqual(['fums-token-1'])
  })

  it('serves later requests from the cache without another fetch', async () => {
    const { source, calls } = setup()
    await source.passage(john15_4to5, 'nkjv')

    const passage = await source.passage(john15_4to5, 'nkjv')

    expect(calls).toHaveLength(1)
    expect(passage.status).toBe('ok')
    if (passage.status === 'ok') {
      expect(passage.attribution).toBe('Copyright © 1982 Thomas Nelson')
    }
  })

  it('treats translations outside the online catalog as unavailable without fetching', async () => {
    const { source, calls } = setup()

    expect(await source.passage(john15_4to5, 'niv')).toEqual({
      status: 'unavailable',
    })
    expect(calls).toHaveLength(0)
  })

  it('is unavailable without an api key when nothing is cached', async () => {
    const { source, calls } = setup({ apiKey: null })

    expect(await source.passage(john15_4to5, 'nkjv')).toEqual({
      status: 'unavailable',
    })
    expect(calls).toHaveLength(0)
  })

  it('serves a fully cached passage without an api key and without fetching', async () => {
    const withKey = setup()
    await withKey.source.passage(john15_4to5, 'nkjv')

    const { source, calls } = setup({ apiKey: null, dataDir: withKey.dataDir })
    const passage = await source.passage(john15_4to5, 'nkjv')

    expect(passage.status).toBe('ok')
    if (passage.status === 'ok') {
      expect(passage.verses).toHaveLength(2)
      expect(passage.attribution).toBe('Copyright © 1982 Thomas Nelson')
    }
    expect(calls).toHaveLength(0)
  })

  it('refuses passages beyond the 500-verse fetch cap without fetching', async () => {
    const { source, calls } = setup()
    const wholeJohn: Reference = {
      book: 43,
      ranges: [
        { startId: makeVerseId(43, 1, 1), endId: makeVerseId(43, 21, 25) },
      ],
    }

    expect(await source.passage(wholeJohn, 'nkjv')).toEqual({
      status: 'unavailable',
    })
    expect(calls).toHaveLength(0)
    expect(ONLINE_FETCH_VERSE_LIMIT).toBe(500)
  })

  it('degrades to unavailable when the fetch fails', async () => {
    const { source } = setup({ responses: {} })

    expect(await source.passage(john15_4to5, 'nkjv')).toEqual({
      status: 'unavailable',
    })
  })
})
