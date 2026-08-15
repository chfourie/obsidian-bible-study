import type { ApiBiblePassage } from '../modules/api-bible-client'
import type { PassageCache } from '../modules/passage-cache'
import { enumerateVerseIds, type Reference } from '../reference'
import type { Passage, PassageSource, PassageVerse } from './module-passage-source'

export const ONLINE_FETCH_VERSE_LIMIT = 500

export type OnlinePassageClient = {
  fetchPassage(reference: Reference, apiBibleId: string): Promise<ApiBiblePassage>
}

export type OnlinePassageDeps = {
  client: OnlinePassageClient
  cache: PassageCache
  reportFums: (fumsToken: string) => void
  apiBibleIdFor: (translationId: string) => string | null
}

const UNAVAILABLE: Passage = { status: 'unavailable' }

const toPassage = (
  verseIds: number[],
  texts: Map<number, string>,
  attribution: string | null,
): Passage => {
  const verses: PassageVerse[] = []
  for (const verseId of verseIds) {
    const text = texts.get(verseId)
    if (text === undefined) continue
    verses.push({ verseId, segments: [{ text, redLetter: false }] })
  }
  if (verses.length === 0) return UNAVAILABLE
  return { status: 'ok', verses, attribution }
}

export class OnlinePassageSource implements PassageSource {
  constructor(private readonly deps: OnlinePassageDeps) {}

  async passage(reference: Reference, translationId: string): Promise<Passage> {
    const apiBibleId = this.deps.apiBibleIdFor(translationId)
    if (apiBibleId === null) return UNAVAILABLE
    const verseIds = reference.ranges.flatMap(enumerateVerseIds)
    if (verseIds.length > ONLINE_FETCH_VERSE_LIMIT) return UNAVAILABLE
    const cached = await this.deps.cache.readVerses(translationId, verseIds)
    if (cached.size === verseIds.length) {
      return toPassage(
        verseIds,
        cached,
        await this.deps.cache.copyright(translationId),
      )
    }
    return this.#fetch(reference, translationId, apiBibleId, verseIds)
  }

  async #fetch(
    reference: Reference,
    translationId: string,
    apiBibleId: string,
    verseIds: number[],
  ): Promise<Passage> {
    try {
      const fetched = await this.deps.client.fetchPassage(reference, apiBibleId)
      await this.deps.cache.storeVerses(translationId, fetched.verses)
      await this.deps.cache.storeCopyright(translationId, fetched.copyright)
      for (const fumsToken of fetched.fumsTokens) this.deps.reportFums(fumsToken)
      return toPassage(verseIds, fetched.verses, fetched.copyright)
    } catch {
      return UNAVAILABLE
    }
  }
}
