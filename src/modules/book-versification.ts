import {
  deregisterBookVersification,
  registerBookVersification,
} from '../reference'
import { isBookManifest, type ModuleManifest } from './module-manifest'

// The manifest's section table is the book's versification data. A malformed
// table is reported and skipped — it must never take plugin load down with it.
export const registerManifestVersification = (
  manifest: ModuleManifest,
): void => {
  if (!isBookManifest(manifest)) return
  try {
    registerBookVersification({
      book: manifest.book.number,
      sections: manifest.book.sections,
    })
  } catch (error) {
    console.error(error)
  }
}

export const deregisterManifestVersification = (
  manifest: ModuleManifest,
): void => {
  if (!isBookManifest(manifest)) return
  deregisterBookVersification(manifest.book.number)
}
