import { uniqueNotePath } from '../notes'
import { formatReference, type Reference } from '../reference'

export const annotationFilePath = (
  folder: string,
  reference: Reference,
  exists: (path: string) => boolean,
): string =>
  uniqueNotePath(folder, formatReference(reference).replace(/:/g, '.'), exists)
