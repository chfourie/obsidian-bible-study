export type Book = {
  id: number
  name: string
  osis: string
  abbrev: string
  aliases: readonly string[]
}

// One addressable section of a registered book. `named` marks a section the
// printed work gives no chapter number to (Preface, Notes, the closing
// Prayer) — its name replaces the chapter locator when a reference to it is
// displayed (spec-books §4).
export type BookSectionLabel = {
  chapter: number
  name: string
  named?: boolean
}

// A non-biblical book, known only while its module is installed. Scripture's
// 66 stay compiled in; books arrive and leave with their manifests.
export type RegisteredBook = {
  id: number
  name: string
  abbrev: string
  aliases: readonly string[]
  moduleId: string
  editionCode: string
  author: string
  year: number
  sections: readonly BookSectionLabel[]
}

const BOOK_NAMES: readonly [
  name: string,
  osis: string,
  abbrev: string,
  ...aliases: string[],
][] = [
  ['Genesis', 'Gen', 'Gen'],
  ['Exodus', 'Exod', 'Exo'],
  ['Leviticus', 'Lev', 'Lev'],
  ['Numbers', 'Num', 'Num'],
  ['Deuteronomy', 'Deut', 'Deu'],
  ['Joshua', 'Josh', 'Jos'],
  ['Judges', 'Judg', 'Jdg'],
  ['Ruth', 'Ruth', 'Rut'],
  ['1 Samuel', '1Sam', '1Sa'],
  ['2 Samuel', '2Sam', '2Sa'],
  ['1 Kings', '1Kgs', '1Ki'],
  ['2 Kings', '2Kgs', '2Ki'],
  ['1 Chronicles', '1Chr', '1Ch'],
  ['2 Chronicles', '2Chr', '2Ch'],
  ['Ezra', 'Ezra', 'Ezr'],
  ['Nehemiah', 'Neh', 'Neh'],
  ['Esther', 'Esth', 'Est'],
  ['Job', 'Job', 'Job'],
  ['Psalms', 'Ps', 'Psa', 'Psalm'],
  ['Proverbs', 'Prov', 'Pro'],
  ['Ecclesiastes', 'Eccl', 'Ecc'],
  ['Song of Solomon', 'Song', 'Sng', 'Song of Songs'],
  ['Isaiah', 'Isa', 'Isa'],
  ['Jeremiah', 'Jer', 'Jer'],
  ['Lamentations', 'Lam', 'Lam'],
  ['Ezekiel', 'Ezek', 'Eze'],
  ['Daniel', 'Dan', 'Dan'],
  ['Hosea', 'Hos', 'Hos'],
  ['Joel', 'Joel', 'Joe'],
  ['Amos', 'Amos', 'Amo'],
  ['Obadiah', 'Obad', 'Oba'],
  ['Jonah', 'Jonah', 'Jon'],
  ['Micah', 'Mic', 'Mic'],
  ['Nahum', 'Nah', 'Nah'],
  ['Habakkuk', 'Hab', 'Hab'],
  ['Zephaniah', 'Zeph', 'Zep'],
  ['Haggai', 'Hag', 'Hag'],
  ['Zechariah', 'Zech', 'Zec'],
  ['Malachi', 'Mal', 'Mal'],
  ['Matthew', 'Matt', 'Mat'],
  ['Mark', 'Mark', 'Mrk'],
  ['Luke', 'Luke', 'Luk'],
  ['John', 'John', 'Jhn'],
  ['Acts', 'Acts', 'Act'],
  ['Romans', 'Rom', 'Rom'],
  ['1 Corinthians', '1Cor', '1Co'],
  ['2 Corinthians', '2Cor', '2Co'],
  ['Galatians', 'Gal', 'Gal'],
  ['Ephesians', 'Eph', 'Eph'],
  ['Philippians', 'Phil', 'Php'],
  ['Colossians', 'Col', 'Col'],
  ['1 Thessalonians', '1Thess', '1Th'],
  ['2 Thessalonians', '2Thess', '2Th'],
  ['1 Timothy', '1Tim', '1Ti'],
  ['2 Timothy', '2Tim', '2Ti'],
  ['Titus', 'Titus', 'Tit'],
  ['Philemon', 'Phlm', 'Phm'],
  ['Hebrews', 'Heb', 'Heb'],
  ['James', 'Jas', 'Jas'],
  ['1 Peter', '1Pet', '1Pe'],
  ['2 Peter', '2Pet', '2Pe'],
  ['1 John', '1John', '1Jn'],
  ['2 John', '2John', '2Jn'],
  ['3 John', '3John', '3Jn'],
  ['Jude', 'Jude', 'Jud'],
  ['Revelation', 'Rev', 'Rev'],
]

export const BOOKS: readonly Book[] = BOOK_NAMES.map(
  ([name, osis, abbrev, ...aliases], index) => ({
    id: index + 1,
    name,
    osis,
    abbrev,
    aliases,
  }),
)

const normalizeName = (name: string): string =>
  name.toLowerCase().replace(/\.$/, '').replace(/\s+/g, '')

const BOOK_ID_BY_NORMALIZED_NAME = new Map<string, number>(
  BOOKS.flatMap(({ id, name, osis, abbrev, aliases }) =>
    [name, osis, abbrev, ...aliases].map(
      (alias) => [normalizeName(alias), id] as [string, number],
    ),
  ),
)

// Scripture owns 1-66, 67-100 are reserved for canon extensions, and
// non-biblical books start at 101 (ADR 0002).
export const isNonBiblicalBook = (bookId: number): boolean =>
  bookId > BOOKS.length

const registeredById = new Map<number, RegisteredBook>()
const registeredNames = new Map<number, string[]>()

const addressableNames = (book: RegisteredBook): string[] => {
  const kept: string[] = []
  for (const candidate of [book.name, book.abbrev, ...book.aliases]) {
    if (BOOK_ID_BY_NORMALIZED_NAME.has(normalizeName(candidate))) {
      console.warn(
        `Book ${book.id} name "${candidate}" is dropped: scripture already owns it`,
      )
      continue
    }
    kept.push(candidate)
  }
  return kept
}

export const registerBook = (book: RegisteredBook): void => {
  registeredById.set(book.id, book)
  registeredNames.set(book.id, addressableNames(book))
}

export const deregisterBook = (bookId: number): void => {
  registeredById.delete(bookId)
  registeredNames.delete(bookId)
}

export const registeredBook = (bookId: number): RegisteredBook | null =>
  registeredById.get(bookId) ?? null

// Every book installed right now, in book-number order — the order they were
// assigned in, so a listing never depends on install order.
export const registeredBooks = (): RegisteredBook[] =>
  [...registeredById.values()].sort((a, b) => a.id - b.id)

const asBook = (book: RegisteredBook, names: string[]): Book => ({
  id: book.id,
  name: names[0],
  osis: book.abbrev,
  abbrev: book.abbrev,
  aliases: names.slice(1),
})

// Registered books that can still be typed: a book whose every name collides
// with scripture keeps its identity for display but is not addressable.
const addressableBooks = (): Book[] =>
  [...registeredById.values()].flatMap((book) => {
    const names = registeredNames.get(book.id) ?? []
    return names.length === 0 ? [] : [asBook(book, names)]
  })

export const bookIdForName = (name: string): number | null => {
  const normalized = normalizeName(name)
  const scripture = BOOK_ID_BY_NORMALIZED_NAME.get(normalized)
  if (scripture !== undefined) return scripture
  for (const [id, names] of registeredNames) {
    if (names.some((candidate) => normalizeName(candidate) === normalized)) {
      return id
    }
  }
  return null
}

export const booksMatchingPrefix = (prefix: string): readonly Book[] => {
  const normalized = normalizeName(prefix)
  return [...BOOKS, ...addressableBooks()].filter((book) =>
    [book.name, book.osis, book.abbrev, ...book.aliases].some((alias) =>
      normalizeName(alias).startsWith(normalized),
    ),
  )
}

export const bookName = (bookId: number): string =>
  BOOKS[bookId - 1]?.name ??
  registeredById.get(bookId)?.name ??
  `Book ${bookId}`
