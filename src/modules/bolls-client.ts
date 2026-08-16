import { requestUrl } from 'obsidian'
import { BOLLS_CATALOG_SNAPSHOT } from './bolls-catalog-snapshot'
import type { TextTransport } from './translation-source'
import {
  normalizeBollsTranslation,
  type BollsVerse,
} from './normalize-bolls-translation'
import type { NormalizedModule } from './normalize-getbible-translation'

const CATALOG_URL = 'https://bolls.life/static/bolls/app/views/languages.json'
const DUMP_BASE_URL = 'https://bolls.life/static/translations'

export type BollsCatalogTranslation = {
  id: string
  name: string
  language: string
}

export type BollsCatalogEntry = {
  short_name: string
  full_name: string
  updated?: number
  dir?: string
}

export type BollsCatalogLanguage = {
  language: string
  translations: BollsCatalogEntry[]
}

export type BollsTranslationDownload = {
  verses: BollsVerse[]
  checksum: string
  url: string
}

const requestUrlTransport: TextTransport = async (url) =>
  (await requestUrl({ url })).text

const sha256Hex = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

type CatalogRow = BollsCatalogTranslation & { shortName: string }

const flattenCatalog = (languages: BollsCatalogLanguage[]): CatalogRow[] =>
  languages.flatMap(({ language, translations }) =>
    translations.map(({ short_name, full_name }) => ({
      id: short_name.toLowerCase(),
      name: full_name,
      language,
      shortName: short_name,
    })),
  )

export class BollsClient {
  constructor(private readonly fetchText: TextTransport = requestUrlTransport) {}

  async fetchCatalog(): Promise<BollsCatalogTranslation[]> {
    return (await this.#catalogRows()).map(({ id, name, language }) => ({
      id,
      name,
      language,
    }))
  }

  async #catalogRows(): Promise<CatalogRow[]> {
    try {
      const raw = await this.fetchText(CATALOG_URL)
      return flattenCatalog(JSON.parse(raw) as BollsCatalogLanguage[])
    } catch {
      return flattenCatalog(BOLLS_CATALOG_SNAPSHOT)
    }
  }

  async fetchModule(moduleId: string): Promise<NormalizedModule> {
    const rows = await this.#catalogRows()
    const row = rows.find((entry) => entry.id === moduleId.toLowerCase())
    if (row === undefined)
      throw new Error(`translation ${moduleId} is not in the bolls catalogue`)
    const download = await this.fetchTranslation(row.shortName)
    return normalizeBollsTranslation(
      row.id,
      download.verses,
      { name: row.name, language: row.language },
      { source: download.url, sourceChecksum: download.checksum },
    )
  }

  async fetchTranslation(bollsId: string): Promise<BollsTranslationDownload> {
    const url = `${DUMP_BASE_URL}/${bollsId}.json`
    const raw = await this.fetchText(url)
    return {
      verses: JSON.parse(raw) as BollsVerse[],
      checksum: await sha256Hex(raw),
      url,
    }
  }
}
