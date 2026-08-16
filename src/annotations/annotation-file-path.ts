import { formatReference, type Reference } from '../reference'

export const annotationFilePath = (
  folder: string,
  reference: Reference,
  exists: (path: string) => boolean,
): string => {
  const base = `${folder}/${formatReference(reference).replace(/:/g, '.')}`
  let candidate = `${base}.md`
  for (let suffix = 1; exists(candidate); suffix++) {
    candidate = `${base} ${suffix}.md`
  }
  return candidate
}
