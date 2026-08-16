import { describe, expect, it } from 'vitest'
import { GetBibleClient } from './getbible-client'

const WEB_JSON = '{"abbreviation":"web","translation":"World English Bible"}'
const WEB_JSON_SHA1 = '918b78581b5cbf6aad76aac085c729669d50b90d'

const fakeTransport =
  (responses: Record<string, string>) =>
  async (url: string): Promise<string> => {
    const response = responses[url]
    if (response === undefined) throw new Error(`no response for ${url}`)
    return response
  }

describe('GetBibleClient', () => {
  it('fetches and parses a translation, reporting the checksum of the downloaded bytes', async () => {
    const client = new GetBibleClient(
      fakeTransport({ 'https://api.getbible.net/v2/web.json': WEB_JSON }),
    )

    const download = await client.fetchTranslation('web')

    expect(download.document.abbreviation).toBe('web')
    expect(download.document.translation).toBe('World English Bible')
    expect(download.checksum).toBe(WEB_JSON_SHA1)
    expect(download.url).toBe('https://api.getbible.net/v2/web.json')
  })

  it('lists the downloadable translations with name and language', async () => {
    const client = new GetBibleClient(
      fakeTransport({
        'https://api.getbible.net/v2/translations.json':
          '{"web":{"abbreviation":"web","translation":"World English Bible","language":"English"},' +
          '"aov":{"abbreviation":"aov","translation":"Ou Vertaling","language":"Afrikaans"}}',
      }),
    )

    expect(await client.fetchAvailableTranslations()).toEqual([
      { id: 'web', name: 'World English Bible', language: 'English' },
      { id: 'aov', name: 'Ou Vertaling', language: 'Afrikaans' },
    ])
  })

  it('fetches the published checksums for all translations', async () => {
    const client = new GetBibleClient(
      fakeTransport({
        'https://api.getbible.net/v2/checksum.json':
          '{"web":"aaa","kjv":"bbb"}',
      }),
    )

    expect(await client.fetchChecksums()).toEqual({ web: 'aaa', kjv: 'bbb' })
  })
})
