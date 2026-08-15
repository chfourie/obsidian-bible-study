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

  async fetchChecksums(): Promise<Record<string, string>> {
    const raw = await this.fetchText(`${GETBIBLE_BASE_URL}/checksum.json`)
    return JSON.parse(raw) as Record<string, string>
  }
}
