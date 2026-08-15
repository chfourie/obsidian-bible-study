import { BOOK_COUNT, decodeVerseId } from '../reference'
import type { ModuleDataDir } from './module-data-dir'

export const PASSAGE_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000

const CACHE_ROOT = 'cache'

const SAFE_TRANSLATION_ID = /^[A-Za-z0-9_-]+$/

export type Clock = () => number

type CachedVerse = { text: string; fetchedAt: number }

type CachedBook = Record<number, CachedVerse>

type CacheManifest = { id: string; copyright: string | null }

const translationDir = (translationId: string): string => {
  if (!SAFE_TRANSLATION_ID.test(translationId))
    throw new Error(`unsafe translation id: ${translationId}`)
  return `${CACHE_ROOT}/${translationId}`
}

const bookPath = (translationId: string, book: number): string =>
  `${translationDir(translationId)}/${String(book).padStart(3, '0')}.json`

const manifestPath = (translationId: string): string =>
  `${translationDir(translationId)}/manifest.json`

const parseOrNull = <T>(content: string | null): T | null => {
  if (content === null) return null
  try {
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

export class PassageCache {
  constructor(
    private readonly dataDir: ModuleDataDir,
    private readonly now: Clock = Date.now,
  ) {}

  async readVerses(
    translationId: string,
    verseIds: number[],
  ): Promise<Map<number, string>> {
    const verses = new Map<number, string>()
    for (const book of booksOf(verseIds)) {
      const fresh = await this.#freshBook(translationId, book)
      if (fresh === null) continue
      for (const verseId of verseIds) {
        const entry = fresh[verseId]
        if (entry !== undefined) verses.set(verseId, entry.text)
      }
    }
    return verses
  }

  async storeVerses(
    translationId: string,
    verses: Map<number, string>,
  ): Promise<void> {
    const fetchedAt = this.now()
    for (const book of booksOf([...verses.keys()])) {
      const content =
        parseOrNull<CachedBook>(
          await this.dataDir.readTextFile(bookPath(translationId, book)),
        ) ?? {}
      for (const [verseId, text] of verses) {
        if (decodeVerseId(verseId).book === book)
          content[verseId] = { text, fetchedAt }
      }
      await this.dataDir.writeTextFile(
        bookPath(translationId, book),
        JSON.stringify(content),
      )
    }
  }

  async storeCopyright(
    translationId: string,
    copyright: string | null,
  ): Promise<void> {
    const manifest: CacheManifest = { id: translationId, copyright }
    await this.dataDir.writeTextFile(
      manifestPath(translationId),
      JSON.stringify(manifest, null, 2),
    )
  }

  async copyright(translationId: string): Promise<string | null> {
    const manifest = parseOrNull<CacheManifest>(
      await this.dataDir.readTextFile(manifestPath(translationId)),
    )
    return manifest?.copyright ?? null
  }

  async clear(translationId: string): Promise<void> {
    await this.dataDir.removeDir(translationDir(translationId))
  }

  async purgeExpired(): Promise<void> {
    const translationIds = await this.dataDir.listDirs(CACHE_ROOT)
    for (const translationId of translationIds) {
      if (!SAFE_TRANSLATION_ID.test(translationId)) continue
      for (let book = 1; book <= BOOK_COUNT; book += 1) {
        await this.#freshBook(translationId, book)
      }
    }
  }

  async #freshBook(
    translationId: string,
    book: number,
  ): Promise<CachedBook | null> {
    const path = bookPath(translationId, book)
    const content = parseOrNull<CachedBook>(
      await this.dataDir.readTextFile(path),
    )
    if (content === null) return null
    const fresh: CachedBook = {}
    let purged = false
    for (const [key, entry] of Object.entries(content)) {
      if (this.now() - entry.fetchedAt >= PASSAGE_CACHE_TTL_MS) {
        purged = true
      } else {
        fresh[Number(key)] = entry
      }
    }
    if (purged) await this.dataDir.writeTextFile(path, JSON.stringify(fresh))
    return fresh
  }
}

const booksOf = (verseIds: number[]): Set<number> =>
  new Set(verseIds.map((verseId) => decodeVerseId(verseId).book))
