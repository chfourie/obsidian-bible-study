import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import type { ModuleDataDir } from './module-data-dir'
import { ChecksumMismatchError, ModuleManager } from './module-manager'
import { ModuleStore } from './module-store'
import type { GetBibleTranslation } from './normalize-getbible-translation'
import type {
  TranslationDownload,
  TranslationSource,
} from './translation-source'

class InMemoryModuleDataDir implements ModuleDataDir {
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

const webDocument = (): GetBibleTranslation => ({
  translation: 'World English Bible',
  abbreviation: 'web',
  lang: 'en',
  language: 'English',
  distribution_license: 'Public Domain',
  books: [
    {
      nr: 43,
      name: 'John',
      chapters: [
        {
          chapter: 15,
          name: 'John 15',
          verses: [
            {
              chapter: 15,
              verse: 4,
              name: 'John 15:4',
              text: 'Remain in me, and I in you.',
            },
          ],
        },
      ],
    },
  ],
})

class FakeTranslationSource implements TranslationSource {
  checksums: Record<string, string> = { web: 'sha-web-1' }
  downloads: Record<string, TranslationDownload> = {
    web: {
      document: webDocument(),
      checksum: 'sha-web-1',
      url: 'https://api.getbible.net/v2/web.json',
    },
  }

  async fetchTranslation(translationId: string): Promise<TranslationDownload> {
    const download = this.downloads[translationId]
    if (!download) throw new Error(`unknown translation ${translationId}`)
    return download
  }

  async fetchChecksums(): Promise<Record<string, string>> {
    return this.checksums
  }
}

const setup = () => {
  const source = new FakeTranslationSource()
  const store = new ModuleStore(new InMemoryModuleDataDir())
  const manager = new ModuleManager(source, store)
  return { source, store, manager }
}

describe('ModuleManager download', () => {
  it('installs a translation as a readable module with its source checksum', async () => {
    const { store, manager } = setup()

    const manifest = await manager.downloadModule('web')

    expect(manifest).toEqual({
      id: 'web',
      name: 'World English Bible',
      language: 'English',
      license: 'Public Domain',
      source: 'https://api.getbible.net/v2/web.json',
      sourceChecksum: 'sha-web-1',
      formatVersion: 1,
      capabilities: { strongsTagged: false },
    })
    expect(await store.manifest('web')).toEqual(manifest)
    expect(await store.verseText('web', makeVerseId(43, 15, 4))).toBe(
      'Remain in me, and I in you.',
    )
  })

  it('rejects a download whose bytes do not match the published checksum', async () => {
    const { source, store, manager } = setup()
    source.checksums.web = 'sha-web-2'

    await expect(manager.downloadModule('web')).rejects.toBeInstanceOf(
      ChecksumMismatchError,
    )
    expect(await store.manifest('web')).toBeNull()
  })

  it('installs with the downloaded checksum when no published checksum exists', async () => {
    const { source, manager } = setup()
    delete source.checksums.web

    const manifest = await manager.downloadModule('web')

    expect(manifest.sourceChecksum).toBe('sha-web-1')
  })
})
