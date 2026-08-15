import type { TaggedVerse } from '../../src/modules/verse-content'
import { bookIdForName } from '../../src/reference/books'
import { makeVerseId } from '../../src/reference/verse-id'

const COLUMN = {
  bsbSort: 2,
  strHeb: 10,
  strGrk: 11,
  verseId: 12,
  begQ: 17,
  bsbText: 18,
  pnc: 19,
  endQ: 20,
} as const

const UNTRANSLATED_PLACEHOLDERS = new Set(['-', 'vvv', '. . .'])

const stripHtml = (value: string): string =>
  value
    .replace(/<span class=\|reftext\|>.*?<\/span>/g, '')
    .replace(/<[^>]*>/g, '')

const cleanColumn = (value: string): string => stripHtml(value).trim()

const cleanWord = (value: string): string =>
  cleanColumn(value).replace(/[[\]]/g, '')

const strongsNumber = (row: string[]): string | null => {
  const hebrew = row[COLUMN.strHeb]?.trim() ?? ''
  if (/^\d+$/.test(hebrew)) return `H${hebrew.padStart(4, '0')}`
  const greek = row[COLUMN.strGrk]?.trim() ?? ''
  if (/^\d+$/.test(greek)) return `G${greek.padStart(4, '0')}`
  return null
}

const parseVerseMarker = (
  marker: string,
): { book: number; chapter: number; verse: number } | null => {
  const match = /^(.*?)\s+(\d+):(\d+)$/.exec(marker.trim())
  if (match === null) return null
  const book = bookIdForName(match[1])
  if (book === null) return null
  return { book, chapter: Number(match[2]), verse: Number(match[3]) }
}

const assembleVerse = (rows: string[][]): TaggedVerse => {
  const ordered = [...rows].sort(
    (a, b) => Number(a[COLUMN.bsbSort]) - Number(b[COLUMN.bsbSort]),
  )
  let text = ''
  const tags: TaggedVerse['tags'] = []
  for (const row of ordered) {
    const word = cleanWord(row[COLUMN.bsbText] ?? '')
    if (word === '' || UNTRANSLATED_PLACEHOLDERS.has(word)) continue
    const prefix = cleanColumn(row[COLUMN.begQ] ?? '')
    const suffix =
      cleanColumn(row[COLUMN.pnc] ?? '') + cleanColumn(row[COLUMN.endQ] ?? '')
    if (text !== '') text += ' '
    text += prefix
    const start = text.length
    text += word
    const strongs = strongsNumber(row)
    if (strongs !== null) tags.push({ start, end: text.length, strongs: [strongs] })
    text += suffix
  }
  return { text, tags }
}

export type BsbBooks = Map<number, Record<number, TaggedVerse>>

export const parseBsbTables = (tsv: string): BsbBooks => {
  const books: BsbBooks = new Map()
  let currentVerseId: number | null = null
  let currentBook: number | null = null
  let currentRows: string[][] = []

  const flush = (): void => {
    if (currentVerseId === null || currentBook === null) return
    const bookContent = books.get(currentBook) ?? {}
    bookContent[currentVerseId] = assembleVerse(currentRows)
    books.set(currentBook, bookContent)
  }

  for (const line of tsv.split('\n')) {
    const row = line.split('\t')
    const marker = row[COLUMN.verseId]?.trim() ?? ''
    if (marker !== '') {
      const parsed = parseVerseMarker(marker)
      if (parsed !== null) {
        flush()
        currentBook = parsed.book
        currentVerseId = makeVerseId(parsed.book, parsed.chapter, parsed.verse)
        currentRows = []
      }
    }
    if (currentVerseId !== null) currentRows.push(row)
  }
  flush()
  return books
}
