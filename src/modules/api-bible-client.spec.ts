import { describe, expect, it } from 'vitest'
import { makeVerseId, type Reference } from '../reference'
import {
  ApiBibleClient,
  MissingApiKeyError,
  VerseCountMismatchError,
} from './api-bible-client'

const NKJV_BIBLE_ID = '63097d2a0a2f7db3-01'

const PASSAGE_QUERY =
  'content-type=json&include-notes=false&include-titles=false' +
  '&include-chapter-numbers=false&include-verse-numbers=false'

const passageUrl = (passageId: string): string =>
  `https://api.scripture.api.bible/v1/bibles/${NKJV_BIBLE_ID}/passages/${passageId}?${PASSAGE_QUERY}`

type RecordedRequest = { url: string; headers: Record<string, string> }

const recordingTransport = (responses: Record<string, string>) => {
  const requests: RecordedRequest[] = []
  const transport = async (
    url: string,
    headers: Record<string, string>,
  ): Promise<string> => {
    requests.push({ url, headers })
    const response = responses[url]
    if (response === undefined) throw new Error(`no response for ${url}`)
    return response
  }
  return { requests, transport }
}

type ContentItem = Record<string, unknown>

const verseText = (verseId: string, text: string): ContentItem => ({
  type: 'text',
  text,
  attrs: { verseId },
})

const passageResponse = (options: {
  items: ContentItem[]
  verseCount: number
  copyright?: string
  fumsToken?: string
}): string =>
  JSON.stringify({
    data: {
      content: [
        {
          name: 'para',
          type: 'tag',
          attrs: { style: 'p' },
          items: options.items,
        },
      ],
      copyright: options.copyright ?? 'Copyright © 1982 Thomas Nelson',
      verseCount: options.verseCount,
    },
    meta: { fumsToken: options.fumsToken ?? 'fums-token-1' },
  })

const singleVerse = (book: number, chapter: number, verse: number): Reference => ({
  book,
  ranges: [
    {
      startId: makeVerseId(book, chapter, verse),
      endId: makeVerseId(book, chapter, verse),
    },
  ],
})

describe('ApiBibleClient', () => {
  it('fetches a single verse with the api key header and parses its text', async () => {
    const { requests, transport } = recordingTransport({
      [passageUrl('JHN.15.4')]: passageResponse({
        items: [verseText('JHN.15.4', 'Abide in Me, and I in you.')],
        verseCount: 1,
      }),
    })
    const client = new ApiBibleClient(() => 'secret-key', transport)

    const passage = await client.fetchPassage(
      singleVerse(43, 15, 4),
      NKJV_BIBLE_ID,
    )

    expect(requests).toHaveLength(1)
    expect(requests[0].headers).toEqual({ 'api-key': 'secret-key' })
    expect(passage.verses).toEqual(
      new Map([[makeVerseId(43, 15, 4), 'Abide in Me, and I in you.']]),
    )
    expect(passage.copyright).toBe('Copyright © 1982 Thomas Nelson')
    expect(passage.fumsTokens).toEqual(['fums-token-1'])
  })

  it('fetches a verse range as one passage, joining split text nodes per verse', async () => {
    const { requests, transport } = recordingTransport({
      [passageUrl('JHN.15.4-JHN.15.5')]: passageResponse({
        items: [
          verseText('JHN.15.4', 'Abide in Me, '),
          verseText('JHN.15.4', 'and I in you.'),
          verseText('JHN.15.5', 'I am the vine, you are the branches. '),
        ],
        verseCount: 2,
      }),
    })
    const client = new ApiBibleClient(() => 'secret-key', transport)

    const passage = await client.fetchPassage(
      {
        book: 43,
        ranges: [
          { startId: makeVerseId(43, 15, 4), endId: makeVerseId(43, 15, 5) },
        ],
      },
      NKJV_BIBLE_ID,
    )

    expect(requests.map((request) => request.url)).toEqual([
      passageUrl('JHN.15.4-JHN.15.5'),
    ])
    expect(passage.verses).toEqual(
      new Map([
        [makeVerseId(43, 15, 4), 'Abide in Me, and I in you.'],
        [makeVerseId(43, 15, 5), 'I am the vine, you are the branches.'],
      ]),
    )
  })

  it('splits a long range into chunks of at most 200 verses', async () => {
    // KJV grid Genesis 1-8 has 31+25+24+26+32+22+24+22 = 206 verses,
    // so Gen 1:1-8:22 splits after verse 200 = Gen 8:16.
    const { requests, transport } = recordingTransport({
      [passageUrl('GEN.1.1-GEN.8.16')]: passageResponse({
        items: [verseText('GEN.1.1', 'In the beginning...')],
        verseCount: 200,
      }),
      [passageUrl('GEN.8.17-GEN.8.22')]: passageResponse({
        items: [verseText('GEN.8.22', 'While the earth remains...')],
        verseCount: 6,
      }),
    })
    const client = new ApiBibleClient(() => 'secret-key', transport)

    const passage = await client.fetchPassage(
      {
        book: 1,
        ranges: [{ startId: makeVerseId(1, 1, 1), endId: makeVerseId(1, 8, 22) }],
      },
      NKJV_BIBLE_ID,
    )

    expect(requests.map((request) => request.url)).toEqual([
      passageUrl('GEN.1.1-GEN.8.16'),
      passageUrl('GEN.8.17-GEN.8.22'),
    ])
    expect(passage.verses.get(makeVerseId(1, 8, 22))).toBe(
      'While the earth remains...',
    )
  })

  it('fetches each range of a comma-list reference separately, collecting every FUMS token', async () => {
    const { requests, transport } = recordingTransport({
      [passageUrl('JHN.15.4')]: passageResponse({
        items: [verseText('JHN.15.4', 'Abide in Me, and I in you.')],
        verseCount: 1,
        fumsToken: 'token-a',
      }),
      [passageUrl('JHN.15.9')]: passageResponse({
        items: [verseText('JHN.15.9', 'Abide in My love.')],
        verseCount: 1,
        fumsToken: 'token-b',
      }),
    })
    const client = new ApiBibleClient(() => 'secret-key', transport)

    const passage = await client.fetchPassage(
      {
        book: 43,
        ranges: [
          { startId: makeVerseId(43, 15, 4), endId: makeVerseId(43, 15, 4) },
          { startId: makeVerseId(43, 15, 9), endId: makeVerseId(43, 15, 9) },
        ],
      },
      NKJV_BIBLE_ID,
    )

    expect(requests).toHaveLength(2)
    expect(passage.fumsTokens).toEqual(['token-a', 'token-b'])
    expect(passage.verses.size).toBe(2)
  })

  it('rejects a response whose verseCount does not match the requested chunk', async () => {
    const { transport } = recordingTransport({
      [passageUrl('JHN.15.4-JHN.15.5')]: passageResponse({
        items: [verseText('JHN.15.4', 'Abide in Me, and I in you.')],
        verseCount: 1,
      }),
    })
    const client = new ApiBibleClient(() => 'secret-key', transport)

    await expect(
      client.fetchPassage(
        {
          book: 43,
          ranges: [
            { startId: makeVerseId(43, 15, 4), endId: makeVerseId(43, 15, 5) },
          ],
        },
        NKJV_BIBLE_ID,
      ),
    ).rejects.toBeInstanceOf(VerseCountMismatchError)
  })

  it('refuses to fetch without an api key', async () => {
    const { requests, transport } = recordingTransport({})
    const client = new ApiBibleClient(() => null, transport)

    await expect(
      client.fetchPassage(singleVerse(43, 15, 4), NKJV_BIBLE_ID),
    ).rejects.toBeInstanceOf(MissingApiKeyError)
    expect(requests).toHaveLength(0)
  })
})
