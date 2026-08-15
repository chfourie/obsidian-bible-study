import { requestUrl } from 'obsidian'
import {
  decodeVerseId,
  enumerateVerseIds,
  makeVerseId,
  type Reference,
} from '../reference'
import { apiBibleBookCode, bookNumberForApiBibleCode } from './api-bible-books'

const API_BIBLE_BASE_URL = 'https://api.scripture.api.bible/v1'

const PASSAGE_QUERY =
  'content-type=json&include-notes=false&include-titles=false' +
  '&include-chapter-numbers=false&include-verse-numbers=false'

export const API_BIBLE_CHUNK_LIMIT = 200

export type ApiBibleTransport = (
  url: string,
  headers: Record<string, string>,
) => Promise<string>

const requestUrlTransport: ApiBibleTransport = async (url, headers) =>
  (await requestUrl({ url, headers })).text

export class MissingApiKeyError extends Error {
  constructor() {
    super('no API.Bible key configured')
    this.name = 'MissingApiKeyError'
  }
}

export class VerseCountMismatchError extends Error {
  constructor(passage: string, expected: number, received: number | undefined) {
    super(
      `API.Bible returned ${received ?? 'no'} verses for ${passage}, expected ${expected}`,
    )
    this.name = 'VerseCountMismatchError'
  }
}

export type ApiBiblePassage = {
  verses: Map<number, string>
  copyright: string | null
  fumsTokens: string[]
}

type ContentItem = {
  type?: string
  name?: string
  text?: string
  attrs?: { verseId?: string }
  items?: ContentItem[]
}

type PassageResponse = {
  data?: {
    content?: ContentItem[]
    copyright?: string
    verseCount?: number
  }
  meta?: { fumsToken?: string }
}

const verseReference = (verseId: number): string => {
  const { book, chapter, verse } = decodeVerseId(verseId)
  return `${apiBibleBookCode(book)}.${chapter}.${verse}`
}

const passageId = (startId: number, endId: number): string =>
  startId === endId
    ? verseReference(startId)
    : `${verseReference(startId)}-${verseReference(endId)}`

const parseApiVerseId = (apiVerseId: string): number | null => {
  const [code, chapter, verse] = apiVerseId.split('.')
  const book = bookNumberForApiBibleCode(code ?? '')
  const chapterNumber = Number(chapter)
  const verseNumber = Number(verse)
  if (book === null || !Number.isInteger(chapterNumber) || !Number.isInteger(verseNumber))
    return null
  return makeVerseId(book, chapterNumber, verseNumber)
}

const collectVerseTexts = (
  items: ContentItem[],
  verses: Map<number, string>,
): void => {
  for (const item of items) {
    if (item.type === 'tag' && item.name === 'verse') continue
    if (item.type === 'text' && item.attrs?.verseId !== undefined) {
      const verseId = parseApiVerseId(item.attrs.verseId)
      if (verseId !== null && item.text !== undefined) {
        verses.set(verseId, ((verses.get(verseId) ?? '') + item.text))
      }
    }
    if (item.items) collectVerseTexts(item.items, verses)
  }
}

type Chunk = { startId: number; endId: number; verseCount: number }

const chunkVerseIds = (verseIds: number[]): Chunk[] => {
  const chunks: Chunk[] = []
  for (let index = 0; index < verseIds.length; index += API_BIBLE_CHUNK_LIMIT) {
    const chunk = verseIds.slice(index, index + API_BIBLE_CHUNK_LIMIT)
    chunks.push({
      startId: chunk[0],
      endId: chunk[chunk.length - 1],
      verseCount: chunk.length,
    })
  }
  return chunks
}

export class ApiBibleClient {
  constructor(
    private readonly apiKey: () => string | null,
    private readonly fetchJson: ApiBibleTransport = requestUrlTransport,
  ) {}

  async fetchPassage(
    reference: Reference,
    apiBibleId: string,
  ): Promise<ApiBiblePassage> {
    const key = this.apiKey()
    if (key === null || key.trim() === '') throw new MissingApiKeyError()
    const verses = new Map<number, string>()
    const fumsTokens: string[] = []
    let copyright: string | null = null
    for (const range of reference.ranges) {
      for (const chunk of chunkVerseIds(enumerateVerseIds(range))) {
        const response = await this.#fetchChunk(apiBibleId, chunk, key)
        if (response.data?.verseCount !== chunk.verseCount) {
          throw new VerseCountMismatchError(
            passageId(chunk.startId, chunk.endId),
            chunk.verseCount,
            response.data?.verseCount,
          )
        }
        collectVerseTexts(response.data?.content ?? [], verses)
        const chunkCopyright = response.data?.copyright?.trim()
        if (chunkCopyright) copyright = chunkCopyright
        if (response.meta?.fumsToken) fumsTokens.push(response.meta.fumsToken)
      }
    }
    for (const [verseId, text] of verses) verses.set(verseId, text.trim())
    return { verses, copyright, fumsTokens }
  }

  async #fetchChunk(
    apiBibleId: string,
    chunk: { startId: number; endId: number },
    key: string,
  ): Promise<PassageResponse> {
    const url = `${API_BIBLE_BASE_URL}/bibles/${apiBibleId}/passages/${passageId(
      chunk.startId,
      chunk.endId,
    )}?${PASSAGE_QUERY}`
    const raw = await this.fetchJson(url, { 'api-key': key })
    return JSON.parse(raw) as PassageResponse
  }
}
