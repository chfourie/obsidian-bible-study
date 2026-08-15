export type Book = {
  id: number
  name: string
  osis: string
  abbrev: string
}

const BOOK_NAMES: readonly [name: string, osis: string, abbrev: string][] = [
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
  ['Psalms', 'Ps', 'Psa'],
  ['Proverbs', 'Prov', 'Pro'],
  ['Ecclesiastes', 'Eccl', 'Ecc'],
  ['Song of Solomon', 'Song', 'Sng'],
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
  ([name, osis, abbrev], index) => ({ id: index + 1, name, osis, abbrev }),
)

const normalizeName = (name: string): string =>
  name.toLowerCase().replace(/\.$/, '').replace(/\s+/g, '')

const BOOK_ID_BY_NORMALIZED_NAME = new Map<string, number>(
  BOOKS.flatMap(({ id, name, osis, abbrev }) =>
    [name, osis, abbrev].map(
      (alias) => [normalizeName(alias), id] as [string, number],
    ),
  ),
)

export const bookIdForName = (name: string): number | null =>
  BOOK_ID_BY_NORMALIZED_NAME.get(normalizeName(name)) ?? null

export const bookName = (bookId: number): string => BOOKS[bookId - 1].name
