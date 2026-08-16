import { describe, expect, it } from 'vitest'
import { BollsClient } from './bolls-client'

const LANGUAGES_URL = 'https://bolls.life/static/bolls/app/views/languages.json'

const LANGUAGES_JSON = JSON.stringify([
  {
    language: 'English',
    translations: [
      {
        short_name: 'KJV',
        full_name: "King James Version 1769 with Apocrypha and Strong's Numbers",
        updated: 1750968212682,
      },
      {
        short_name: 'WEB',
        full_name: 'World English Bible',
        updated: 1678028993719,
      },
    ],
  },
  {
    language: 'Afrikaans',
    translations: [
      {
        short_name: 'AOV',
        full_name: 'Afrikaanse Ou Vertaling 1933/1953',
        updated: 1591185595149,
      },
    ],
  },
])

const fakeTransport =
  (responses: Record<string, string>) =>
  async (url: string): Promise<string> => {
    const response = responses[url]
    if (response === undefined) throw new Error(`no response for ${url}`)
    return response
  }

describe('BollsClient catalogue', () => {
  it('flattens the live languages catalogue into translation rows', async () => {
    const client = new BollsClient(
      fakeTransport({ [LANGUAGES_URL]: LANGUAGES_JSON }),
    )

    expect(await client.fetchCatalog()).toEqual([
      {
        id: 'KJV',
        name: "King James Version 1769 with Apocrypha and Strong's Numbers",
        language: 'English',
      },
      { id: 'WEB', name: 'World English Bible', language: 'English' },
      {
        id: 'AOV',
        name: 'Afrikaanse Ou Vertaling 1933/1953',
        language: 'Afrikaans',
      },
    ])
  })

  it('falls back to the bundled snapshot when the live fetch fails', async () => {
    const client = new BollsClient(fakeTransport({}))

    const catalog = await client.fetchCatalog()

    expect(catalog.length).toBeGreaterThan(100)
    expect(catalog).toContainEqual({
      id: 'KJV',
      name: "King James Version 1769 with Apocrypha and Strong's Numbers",
      language: 'English',
    })
  })
})

describe('BollsClient translation dump', () => {
  it('fetches and parses a dump, reporting the checksum of the downloaded bytes', async () => {
    const dump =
      '[{"pk":1,"translation":"WEB","book":43,"chapter":15,"verse":4,"text":"Remain in me, and I in you."}]'
    const client = new BollsClient(
      fakeTransport({
        'https://bolls.life/static/translations/WEB.json': dump,
      }),
    )

    const download = await client.fetchTranslation('WEB')

    expect(download.verses).toEqual([
      {
        pk: 1,
        translation: 'WEB',
        book: 43,
        chapter: 15,
        verse: 4,
        text: 'Remain in me, and I in you.',
      },
    ])
    expect(download.url).toBe('https://bolls.life/static/translations/WEB.json')
    // Independently computed: echo -n '<dump>' | shasum -a 256
    expect(download.checksum).toBe(
      '78a9d28be39ea05047342ba8ce178b4fbaa752598d3958e6c6467dbc6e3d63ea',
    )
  })
})
