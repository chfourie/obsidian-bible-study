// The append-only Book Registry (spec-books §7) is the repo-side authority
// mapping book numbers to works. Every book pipeline validates its manifest
// against it, so a renumbered or re-identified book fails the build instead
// of shipping a module that collides with a published grid.

export type BookRegistryEntry = {
  bookNumber: number
  title: string
  author: string
  moduleId: string
  editionCode: string
}

// Scripture holds 1–66 and 67–100 is reserved for canon extensions.
export const FIRST_BOOK_NUMBER = 101

const REQUIRED_FIELDS = [
  'bookNumber',
  'title',
  'author',
  'moduleId',
  'editionCode',
] as const

const readEntry = (candidate: unknown): BookRegistryEntry => {
  const entry = (candidate ?? {}) as Record<string, unknown>
  for (const field of REQUIRED_FIELDS)
    if (entry[field] === undefined)
      throw new Error(`Registry entry is missing "${field}"`)
  const bookNumber = entry.bookNumber
  if (typeof bookNumber !== 'number' || bookNumber < FIRST_BOOK_NUMBER)
    throw new Error(
      `Registry entry "${String(entry.moduleId)}" has book number ` +
        `${String(bookNumber)}; books start at ${FIRST_BOOK_NUMBER}`,
    )
  return entry as unknown as BookRegistryEntry
}

const assertUnique = (
  entries: BookRegistryEntry[],
  field: keyof BookRegistryEntry,
  label: string,
): void => {
  const seen = new Set<BookRegistryEntry[keyof BookRegistryEntry]>()
  for (const entry of entries) {
    if (seen.has(entry[field]))
      throw new Error(`Registry reuses ${label} ${entry[field]}`)
    seen.add(entry[field])
  }
}

export const parseBookRegistry = (json: string): BookRegistryEntry[] => {
  const parsed: unknown = JSON.parse(json)
  if (!Array.isArray(parsed)) throw new Error('Registry must be a list')
  const entries = parsed.map(readEntry)
  assertUnique(entries, 'bookNumber', 'book number')
  assertUnique(entries, 'moduleId', 'module id')
  assertUnique(entries, 'editionCode', 'edition code')
  return entries
}

export const assertRegisteredBook = (
  registration: BookRegistryEntry,
  registry: BookRegistryEntry[],
): void => {
  const entry = registry.find(
    (candidate) => candidate.moduleId === registration.moduleId,
  )
  if (entry === undefined)
    throw new Error(
      `Module ${registration.moduleId} is not in the Book Registry`,
    )
  for (const field of REQUIRED_FIELDS)
    if (entry[field] !== registration[field])
      throw new Error(
        `Manifest ${field} "${registration[field]}" disagrees with ` +
          `registry "${entry[field]}"`,
      )
}
