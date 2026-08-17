import type {
  FormatSpan,
  TaggedVerse,
  VerseLine,
} from '../../src/modules/verse-content'
import { bookIdForName } from '../../src/reference/books'
import { makeVerseId } from '../../src/reference/verse-id'

const COLUMN = {
  bsbSort: 2,
  strHeb: 10,
  strGrk: 11,
  verseId: 12,
  hdg: 13,
  crossref: 14,
  par: 15,
  begQ: 17,
  bsbText: 18,
  pnc: 19,
  endQ: 20,
  endText: 22,
} as const

const UNTRANSLATED_PLACEHOLDERS = new Set(['-', 'vvv', '...'])

const stripHtml = (value: string): string =>
  value
    .replace(/<span class=\|reftext\|>.*?<\/span>/g, '')
    .replace(/<[^>]*>/g, '')

const cleanColumn = (value: string): string => stripHtml(value).trim()

const translatedWord = (
  word: string,
): { text: string; translated: boolean } | null => {
  const bare = word.replace(/[()[\]{}\s]/g, '')
  if (bare !== '' && !UNTRANSLATED_PLACEHOLDERS.has(bare))
    return { text: word, translated: true }
  const punctuationOnly = word.replace(/-|vvv|\.|\s/g, '')
  return punctuationOnly === ''
    ? null
    : { text: punctuationOnly, translated: false }
}

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

type LineMeta = Omit<VerseLine, 'start'>

// Paragraph classes observed in the real bsb_tables.tsv Par column. "red" in
// a class name means the line renders as words of Christ (tracked on the red
// channel); the "1stline" variants open a new poetry stanza.
const LINE_CLASSES: Record<string, LineMeta> = {
  reg: { paragraph: true },
  red: { paragraph: true },
  inscrip: { paragraph: true },
  subhdg: { paragraph: true },
  pshdg: { psalmHeading: true },
  indent1: { indent: 1 },
  indentred1: { indent: 1 },
  tab1: { indent: 1 },
  list1: { indent: 1 },
  indent2: { indent: 2 },
  indentred2: { indent: 2 },
  list2: { indent: 2 },
  indent1stline: { indent: 1, paragraph: true },
  indent1stlinered: { indent: 1, paragraph: true },
  tab1stline: { indent: 1, paragraph: true },
  tab1stlinered: { indent: 1, paragraph: true },
  list1stline: { indent: 1, paragraph: true },
  selah: {},
}

const isRedClass = (className: string): boolean => className.includes('red')

type MarkerEvent = { line: LineMeta; red: boolean } | { line: null; red: true }

// Red markers occasionally land in the Hdg or Crossref column instead of Par
// (data quirks, e.g. Matthew 25:16), so all three cells are scanned; heading
// and cross-reference markup carries no known line class and is ignored.
const markerEvents = (row: string[]): MarkerEvent[] => {
  const cells =
    (row[COLUMN.hdg] ?? '') + (row[COLUMN.crossref] ?? '') + (row[COLUMN.par] ?? '')
  const events: MarkerEvent[] = []
  const pattern = /<(?:p|div) class=\|([a-z0-9]+)\|>|<span class=\|red\|>|<br \/>/g
  for (const match of cells.matchAll(pattern)) {
    const className = match[1]
    if (className === undefined) {
      if (match[0] === '<br />') {
        if ((row[COLUMN.par] ?? '').includes('<br />')) events.push({ line: {}, red: false })
      } else events.push({ line: null, red: true })
      continue
    }
    const line = LINE_CLASSES[className]
    if (line !== undefined) events.push({ line, red: isRedClass(className) })
  }
  return events
}

const RED_CLOSE = '</span>'

// Splits an emitted punctuation cell at a red-letter close: text before the
// </span> is still red, text after is not.
const suffixSegments = (
  raw: string,
): { beforeClose: string; afterClose: string; closes: boolean } => {
  const closeAt = raw.indexOf(RED_CLOSE)
  if (closeAt === -1)
    return { beforeClose: cleanColumn(raw), afterClose: '', closes: false }
  return {
    beforeClose: cleanColumn(raw.slice(0, closeAt)),
    afterClose: cleanColumn(raw.slice(closeAt + RED_CLOSE.length)),
    closes: true,
  }
}

// Red-letter state survives verse and even chapter boundaries: a discourse
// opened by <p class=|red|> or <span class=|red|> stays red until an explicit
// </span> in a punctuation column or a non-red paragraph class closes it.
type AssemblyState = {
  red: boolean
  pendingLine: LineMeta | null
}

type SuppliedAppend = { emitted: string; spans: FormatSpan[] }

// Emits cell text with [...] / {...} supplied-word brackets removed, returning
// the character ranges the brackets covered relative to `offset`.
const appendWithSupplied = (raw: string, offset: number): SuppliedAppend => {
  let emitted = ''
  const spans: FormatSpan[] = []
  let openAt: number | null = null
  for (const char of raw) {
    if (char === '[' || char === '{') openAt = offset + emitted.length
    else if (char === ']' || char === '}') {
      const end = offset + emitted.length
      if (openAt !== null && end > openAt) spans.push({ start: openAt, end })
      openAt = null
    } else emitted += char
  }
  return { emitted, spans }
}

const assembleVerse = (rows: string[][], state: AssemblyState): TaggedVerse => {
  const ordered = [...rows].sort(
    (a, b) => Number(a[COLUMN.bsbSort]) - Number(b[COLUMN.bsbSort]),
  )
  let text = ''
  const tags: TaggedVerse['tags'] = []
  const lines: VerseLine[] = []
  const red: FormatSpan[] = []
  const supplied: FormatSpan[] = []
  let redStart: number | null = null

  const closeRed = (): void => {
    if (redStart !== null && text.length > redStart)
      red.push({ start: redStart, end: text.length })
    redStart = null
    state.red = false
  }

  const append = (raw: string): void => {
    const { emitted, spans } = appendWithSupplied(raw, text.length)
    text += emitted
    supplied.push(...spans)
  }

  for (const row of ordered) {
    for (const event of markerEvents(row)) {
      if (event.line !== null) {
        state.pendingLine = event.line
        if (event.red) state.red = true
        else closeRed()
      } else state.red = true
    }

    const word = translatedWord(cleanColumn(row[COLUMN.bsbText] ?? ''))
    const suffixes = [
      suffixSegments(row[COLUMN.pnc] ?? ''),
      suffixSegments(row[COLUMN.endQ] ?? ''),
      suffixSegments(row[COLUMN.endText] ?? ''),
    ]
    const appendSuffixes = (): void => {
      for (const suffix of suffixes) {
        append(suffix.beforeClose)
        if (suffix.closes) closeRed()
        append(suffix.afterClose)
      }
    }
    if (word === null) {
      appendSuffixes()
      continue
    }

    if (text !== '' && !text.endsWith('(')) text += ' '
    if (state.pendingLine !== null) {
      lines.push({ start: text.length, ...state.pendingLine })
      state.pendingLine = null
    }
    if (state.red && redStart === null) redStart = text.length

    append(cleanColumn(row[COLUMN.begQ] ?? ''))
    const start = text.length
    append(word.text)
    const strongs = strongsNumber(row)
    if (word.translated && strongs !== null)
      tags.push({ start, end: text.length, strongs: [strongs] })

    appendSuffixes()
  }

  const carryRed = state.red
  closeRed()
  state.red = carryRed

  const verse: TaggedVerse = { text, tags }
  if (lines.length > 0) verse.lines = lines
  if (red.length > 0) verse.red = red
  if (supplied.length > 0) verse.supplied = supplied
  return verse
}

export type BsbBooks = Map<number, Record<number, TaggedVerse>>

export const parseBsbTables = (tsv: string): BsbBooks => {
  const books: BsbBooks = new Map()
  const state: AssemblyState = { red: false, pendingLine: null }
  let currentVerseId: number | null = null
  let currentBook: number | null = null
  let currentRows: string[][] = []

  const flush = (): void => {
    if (currentVerseId === null || currentBook === null) return
    const bookContent = books.get(currentBook) ?? {}
    bookContent[currentVerseId] = assembleVerse(currentRows, state)
    books.set(currentBook, bookContent)
  }

  for (const line of tsv.split(/\r?\n/)) {
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
