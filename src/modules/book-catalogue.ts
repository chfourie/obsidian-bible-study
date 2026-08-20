import type { PrebuiltRelease } from './prebuilt-release-client'

// The compiled-in catalogue of downloadable books (spec-books §7). A remote
// catalogue would replace only this array. Module id = edition code
// lowercased, so a future re-cut edition coexists instead of overwriting.
export type BookCatalogueEntry = {
  moduleId: string
  title: string
  author: string
  editionCode: string
  tag: string
  filename: string
}

export const BOOK_CATALOGUE: readonly BookCatalogueEntry[] = [
  {
    moduleId: 'hum-m1895',
    title: 'Humility',
    author: 'Andrew Murray',
    editionCode: 'HUM-M1895',
    tag: 'hum-m1895-module',
    filename: 'hum-m1895-module.json',
  },
]

export const BOOK_MODULE_IDS: readonly string[] = BOOK_CATALOGUE.map(
  (entry) => entry.moduleId,
)

export const bookRelease = ({
  moduleId,
  tag,
  filename,
}: BookCatalogueEntry): PrebuiltRelease => ({ moduleId, tag, filename })
