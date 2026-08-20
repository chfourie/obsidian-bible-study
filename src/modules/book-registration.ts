import {
  deregisterBook,
  deregisterBookVersification,
  registerBook,
  registerBookVersification,
} from '../reference'
import { isBookManifest, type ModuleManifest } from './module-manifest'

// A book exists for the reference grammar exactly while its module is
// installed (spec-books §6): the manifest's section table is the book's
// versification data, and its metadata is the book's identity — name,
// abbreviation, aliases, section names and the citation fields. A malformed
// table is reported and skipped: it must never take plugin load down with it.
export const registerManifestBook = (manifest: ModuleManifest): void => {
  if (!isBookManifest(manifest)) return
  const { book } = manifest
  try {
    registerBookVersification({ book: book.number, sections: book.sections })
  } catch (error) {
    console.error(error)
    return
  }
  registerBook({
    id: book.number,
    name: manifest.name,
    abbrev: book.abbreviation,
    aliases: book.aliases ?? [],
    moduleId: manifest.id,
    editionCode: book.editionCode,
    author: book.author,
    year: book.year,
    sections: book.sections,
  })
}

export const deregisterManifestBook = (manifest: ModuleManifest): void => {
  if (!isBookManifest(manifest)) return
  deregisterBookVersification(manifest.book.number)
  deregisterBook(manifest.book.number)
}
