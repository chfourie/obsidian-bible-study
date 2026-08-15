import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import type { ModuleDataDir } from './module-data-dir'
import { PASSAGE_CACHE_TTL_MS, PassageCache } from './passage-cache'

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

  async listDirs(path: string): Promise<string[]> {
    const dirs = new Set<string>()
    for (const file of this.files.keys()) {
      if (!file.startsWith(`${path}/`)) continue
      const rest = file.slice(path.length + 1)
      const slash = rest.indexOf('/')
      if (slash > 0) dirs.add(rest.slice(0, slash))
    }
    return [...dirs]
  }
}

const JOHN_15_4 = makeVerseId(43, 15, 4)
const JOHN_15_5 = makeVerseId(43, 15, 5)

const setup = (startTime = 1_000_000) => {
  const dataDir = new FakeModuleDataDir()
  let now = startTime
  const cache = new PassageCache(dataDir, () => now)
  return {
    dataDir,
    cache,
    advance: (ms: number) => {
      now += ms
    },
  }
}

describe('PassageCache', () => {
  it('serves stored verses back by verse id', async () => {
    const { cache } = setup()
    await cache.storeVerses(
      'nkjv',
      new Map([
        [JOHN_15_4, 'Abide in Me, and I in you.'],
        [JOHN_15_5, 'I am the vine, you are the branches.'],
      ]),
    )

    const verses = await cache.readVerses('nkjv', [JOHN_15_4, JOHN_15_5])

    expect(verses).toEqual(
      new Map([
        [JOHN_15_4, 'Abide in Me, and I in you.'],
        [JOHN_15_5, 'I am the vine, you are the branches.'],
      ]),
    )
  })

  it('returns only the verses it has, leaving unknown ids absent', async () => {
    const { cache } = setup()
    await cache.storeVerses('nkjv', new Map([[JOHN_15_4, 'Abide in Me.']]))

    const verses = await cache.readVerses('nkjv', [JOHN_15_4, JOHN_15_5])

    expect(verses).toEqual(new Map([[JOHN_15_4, 'Abide in Me.']]))
  })

  it('never serves entries that reached the 14-day expiry', async () => {
    const { cache, advance } = setup()
    await cache.storeVerses('nkjv', new Map([[JOHN_15_4, 'Abide in Me.']]))
    advance(PASSAGE_CACHE_TTL_MS)

    expect(await cache.readVerses('nkjv', [JOHN_15_4])).toEqual(new Map())
  })

  it('purges expired entries from disk on lookup, keeping fresh ones', async () => {
    const { cache, dataDir, advance } = setup()
    await cache.storeVerses('nkjv', new Map([[JOHN_15_4, 'Old fetch.']]))
    advance(PASSAGE_CACHE_TTL_MS - 1)
    await cache.storeVerses('nkjv', new Map([[JOHN_15_5, 'Fresh fetch.']]))
    advance(1)

    const verses = await cache.readVerses('nkjv', [JOHN_15_4, JOHN_15_5])

    expect(verses).toEqual(new Map([[JOHN_15_5, 'Fresh fetch.']]))
    expect(dataDir.files.get('cache/nkjv/043.json')).not.toContain('Old fetch.')
  })

  it('sweeps expired entries from every cached translation', async () => {
    const { cache, dataDir, advance } = setup()
    await cache.storeVerses('nkjv', new Map([[JOHN_15_4, 'Old NKJV.']]))
    await cache.storeVerses('nlt', new Map([[JOHN_15_4, 'Old NLT.']]))
    advance(PASSAGE_CACHE_TTL_MS)

    await cache.purgeExpired()

    expect([...dataDir.files.values()].join()).not.toContain('Old')
  })

  it('stores and serves the translation copyright for attribution', async () => {
    const { cache } = setup()
    await cache.storeCopyright('nkjv', 'Copyright © 1982 Thomas Nelson')

    expect(await cache.copyright('nkjv')).toBe('Copyright © 1982 Thomas Nelson')
    expect(await cache.copyright('nlt')).toBeNull()
  })

  it('clears all cached passages of a translation', async () => {
    const { cache, dataDir } = setup()
    await cache.storeVerses('nkjv', new Map([[JOHN_15_4, 'Abide in Me.']]))
    await cache.storeCopyright('nkjv', 'Copyright © 1982 Thomas Nelson')

    await cache.clear('nkjv')

    expect(await cache.readVerses('nkjv', [JOHN_15_4])).toEqual(new Map())
    expect(await cache.copyright('nkjv')).toBeNull()
    expect(dataDir.files.size).toBe(0)
  })

  it('lays entries out per book under cache/<translation>/', async () => {
    const { cache, dataDir } = setup()
    await cache.storeVerses(
      'nkjv',
      new Map([
        [JOHN_15_4, 'Abide in Me.'],
        [makeVerseId(1, 1, 1), 'In the beginning.'],
      ]),
    )

    expect([...dataDir.files.keys()].sort()).toEqual([
      'cache/nkjv/001.json',
      'cache/nkjv/043.json',
    ])
  })

  it('refuses translation ids that are not a plain path segment', async () => {
    const { cache } = setup()

    await expect(
      cache.storeVerses('../evil', new Map([[JOHN_15_4, 'x']])),
    ).rejects.toThrow('translation id')
    await expect(cache.readVerses('a/b', [JOHN_15_4])).rejects.toThrow(
      'translation id',
    )
  })
})
