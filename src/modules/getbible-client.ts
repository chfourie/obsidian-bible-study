import { requestUrl } from 'obsidian'
import type { GetBibleTranslation } from './normalize-getbible-translation'
import type {
  TranslationDownload,
  TranslationSource,
} from './translation-source'

const GETBIBLE_BASE_URL = 'https://api.getbible.net/v2'

export type TextTransport = (url: string) => Promise<string>

const requestUrlTransport: TextTransport = async (url) =>
  (await requestUrl({ url })).text

const sha1Hex = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-1',
    new TextEncoder().encode(text),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export type DownloadableTranslation = {
  id: string
  name: string
  language: string
}

type CatalogEntry = {
  abbreviation?: string
  translation?: string
  language?: string
}

export class GetBibleClient implements TranslationSource {
  constructor(private readonly fetchText: TextTransport = requestUrlTransport) {}

  async fetchTranslation(translationId: string): Promise<TranslationDownload> {
    const url = `${GETBIBLE_BASE_URL}/${translationId}.json`
    const raw = await this.fetchText(url)
    return {
      document: JSON.parse(raw) as GetBibleTranslation,
      checksum: await sha1Hex(raw),
      url,
    }
  }

  async fetchAvailableTranslations(): Promise<DownloadableTranslation[]> {
    const raw = await this.fetchText(`${GETBIBLE_BASE_URL}/translations.json`)
    const catalog = JSON.parse(raw) as Record<string, CatalogEntry>
    return Object.entries(catalog).map(([id, entry]) => ({
      id,
      name: entry.translation ?? id,
      language: entry.language ?? '',
    }))
  }

  async fetchChecksums(): Promise<Record<string, string>> {
    const raw = await this.fetchText(`${GETBIBLE_BASE_URL}/checksum.json`)
    return JSON.parse(raw) as Record<string, string>
  }
}
