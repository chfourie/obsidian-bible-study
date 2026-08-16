import { BOOK_COUNT, isValidVerseId, makeVerseId } from '../reference'
import { MODULE_FORMAT_VERSION } from './module-manifest'
import type {
  BookContent,
  NormalizedModule,
  SourceInfo,
} from './normalize-getbible-translation'
import type { TaggedVerse } from './verse-content'

export type BollsVerse = {
  pk?: number
  translation?: string
  book: number
  chapter: number
  verse: number
  text: string
  comment?: string
}

export type BollsTranslationMeta = {
  name: string
  language: string
  license?: string
}

const stripInertMarkup = (raw: string): string =>
  raw
    .replace(/<sup>.*?(?:<\/sup>|$)/gs, ' ')
    .replace(/<(?!S>|\/S>)[^>]*>/g, '')

const stripStrayStrongsMarkup = (segment: string): string =>
  segment.replace(/<\/?S>/g, ' ')

const STRONGS_PAIR = /<S>([^<]*)<\/S>/g

const plainText = (raw: string): string =>
  stripStrayStrongsMarkup(stripInertMarkup(raw).replace(STRONGS_PAIR, ' '))
    .replace(/\s+/g, ' ')
    .trim()
const HAS_STRONGS_TAG = /<S>\d+<\/S>/

const LAST_OLD_TESTAMENT_BOOK = 39

const strongsNumber = (book: number, digits: string): string =>
  (book <= LAST_OLD_TESTAMENT_BOOK ? 'H' : 'G') + digits.padStart(4, '0')

const taggedVerse = (book: number, raw: string): TaggedVerse => {
  let text = ''
  const tags: TaggedVerse['tags'] = []

  const appendCollapsed = (segment: string): void => {
    for (const char of segment) {
      if (/\s/.test(char)) {
        if (text !== '' && !text.endsWith(' ')) text += ' '
      } else {
        text += char
      }
    }
  }

  const trailingWordSpan = (): { start: number; end: number } | undefined => {
    let end = text.length
    while (end > 0 && /[\s\p{P}]/u.test(text[end - 1])) end -= 1
    if (end === 0) return undefined
    return { start: text.lastIndexOf(' ', end - 1) + 1, end }
  }

  const recordTag = (strongs: string): void => {
    const lastTag = tags.length > 0 ? tags[tags.length - 1] : undefined
    if (lastTag !== undefined && /^[\s\p{P}]*$/u.test(text.slice(lastTag.end))) {
      lastTag.strongs.push(strongs)
      return
    }
    const word = trailingWordSpan()
    if (word !== undefined) tags.push({ ...word, strongs: [strongs] })
  }

  const cleaned = stripInertMarkup(raw)
  let cursor = 0
  for (const match of cleaned.matchAll(STRONGS_PAIR)) {
    appendCollapsed(stripStrayStrongsMarkup(cleaned.slice(cursor, match.index)))
    cursor = match.index + match[0].length
    if (/^\d+$/.test(match[1])) recordTag(strongsNumber(book, match[1]))
    else appendCollapsed(' ')
  }
  appendCollapsed(stripStrayStrongsMarkup(cleaned.slice(cursor)))
  return { text: text.trimEnd(), tags }
}

const fitsBcvDigits = (value: number): boolean =>
  Number.isInteger(value) && value >= 1 && value <= 999

export const normalizeBollsTranslation = (
  moduleId: string,
  verses: BollsVerse[],
  meta: BollsTranslationMeta,
  sourceInfo: SourceInfo,
): NormalizedModule => {
  const books = new Map<number, BookContent>()
  let strongsTagged = false
  for (const verse of verses) {
    if (verse.book < 1 || verse.book > BOOK_COUNT) continue
    if (!fitsBcvDigits(verse.chapter) || !fitsBcvDigits(verse.verse)) continue
    const verseId = makeVerseId(verse.book, verse.chapter, verse.verse)
    if (!isValidVerseId(verseId)) continue
    const content = books.get(verse.book) ?? {}
    if (HAS_STRONGS_TAG.test(stripInertMarkup(verse.text))) {
      content[verseId] = taggedVerse(verse.book, verse.text)
      strongsTagged = true
    } else {
      content[verseId] = plainText(verse.text)
    }
    books.set(verse.book, content)
  }
  return {
    manifest: {
      id: moduleId,
      name: meta.name,
      language: meta.language,
      license: meta.license ?? '',
      source: sourceInfo.source,
      sourceChecksum: sourceInfo.sourceChecksum,
      formatVersion: MODULE_FORMAT_VERSION,
      capabilities: { strongsTagged },
    },
    books,
  }
}
