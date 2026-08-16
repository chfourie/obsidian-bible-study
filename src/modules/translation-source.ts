import type { GetBibleTranslation } from './normalize-getbible-translation'

export type TextTransport = (url: string) => Promise<string>

export type TranslationDownload = {
  document: GetBibleTranslation
  checksum: string
  url: string
}

export interface TranslationSource {
  fetchTranslation(translationId: string): Promise<TranslationDownload>
  fetchChecksums(): Promise<Record<string, string>>
}
