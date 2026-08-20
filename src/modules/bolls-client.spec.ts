import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import { BollsClient } from './bolls-client'
import { BOLLS_CATALOG_SNAPSHOT } from './bolls-catalog-snapshot'
import { MODULE_FORMAT_VERSION } from './module-manifest'

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
  it('flattens the live languages catalogue into module rows with lowercase ids', async () => {
    const client = new BollsClient(
      fakeTransport({ [LANGUAGES_URL]: LANGUAGES_JSON }),
    )

    expect(await client.fetchCatalog()).toEqual([
      {
        id: 'kjv',
        name: "King James Version 1769 with Apocrypha and Strong's Numbers",
        language: 'English',
      },
      { id: 'web', name: 'World English Bible', language: 'English' },
      {
        id: 'aov',
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
      id: 'kjv',
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

  const clientWithDump = (dump: string): BollsClient =>
    new BollsClient(
      fakeTransport({
        'https://bolls.life/static/translations/WEB.json': dump,
      }),
    )

  it('rejects an empty dump instead of installing a zero-book module', async () => {
    await expect(clientWithDump('[]').fetchTranslation('WEB')).rejects.toThrow(
      /WEB.*not a bolls verse dump/i,
    )
  })

  it('rejects a dump that is not an array', async () => {
    await expect(
      clientWithDump('{"error":"gone"}').fetchTranslation('WEB'),
    ).rejects.toThrow(/WEB.*not a bolls verse dump/i)
  })

  it('rejects a dump whose rows are not verses', async () => {
    const wrongShape = '[{"code":"KJV","title":"King James"}]'
    await expect(
      clientWithDump(wrongShape).fetchTranslation('WEB'),
    ).rejects.toThrow(/WEB.*not a bolls verse dump/i)
  })

  it('rejects a dump with non-numeric verse coordinates or non-string text', async () => {
    const badRow = '[{"book":"43","chapter":15,"verse":4,"text":"Remain."}]'
    await expect(
      clientWithDump(badRow).fetchTranslation('WEB'),
    ).rejects.toThrow(/WEB.*not a bolls verse dump/i)
  })
})

describe('bundled catalogue snapshot', () => {
  it('pins the spec §6.1 counts: 149 translations across 31 languages', () => {
    expect(BOLLS_CATALOG_SNAPSHOT).toHaveLength(31)
    expect(
      BOLLS_CATALOG_SNAPSHOT.flatMap(({ translations }) => translations),
    ).toHaveLength(149)
  })
})

describe('BollsClient as module source', () => {
  const KJV_DUMP =
    '[{"pk":1,"translation":"KJV","book":43,"chapter":15,"verse":4,"text":"Abide<S>3306</S> in me, and I in you."}]'

  const responses = {
    [LANGUAGES_URL]: LANGUAGES_JSON,
    'https://bolls.life/static/translations/KJV.json': KJV_DUMP,
  }

  it('downloads a module by lowercase id, resolving the dump via catalogue casing', async () => {
    const client = new BollsClient(fakeTransport(responses))

    const module = await client.fetchModule('kjv')

    expect(module.manifest).toEqual({
      id: 'kjv',
      name: "King James Version 1769 with Apocrypha and Strong's Numbers",
      language: 'English',
      license: '',
      source: 'https://bolls.life/static/translations/KJV.json',
      // Independently computed: echo -n '<dump>' | shasum -a 256
      sourceChecksum:
        '3e2ba7aeb0e9b8f771ffaf11d89748871d4e8fe60cdc9837c84975926b77e058',
      formatVersion: MODULE_FORMAT_VERSION,
      capabilities: { strongsTagged: true },
    })
    expect(module.books.get(43)).toEqual({
      [makeVerseId(43, 15, 4)]: {
        text: 'Abide in me, and I in you.',
        tags: [{ start: 0, end: 5, strongs: ['G3306'] }],
      },
    })
  })

  it('resolves catalogue entries from the snapshot when the live catalogue is unavailable', async () => {
    const client = new BollsClient(
      fakeTransport({
        'https://bolls.life/static/translations/KJV.json': KJV_DUMP,
      }),
    )

    const module = await client.fetchModule('kjv')

    expect(module.manifest.id).toBe('kjv')
    expect(module.manifest.language).toBe('English')
  })

  it('rejects a module id missing from the catalogue', async () => {
    const client = new BollsClient(fakeTransport(responses))

    await expect(client.fetchModule('nope')).rejects.toThrow(
      /nope.*not in the bolls catalogue/i,
    )
  })
})
