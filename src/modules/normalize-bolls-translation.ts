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
  raw.replace(/<sup>.*?<\/sup>/gs, ' ').replace(/<(?!S>|\/S>)[^>]*>/g, '')

const plainText = (raw: string): string =>
  stripInertMarkup(raw).replace(/\s+/g, ' ').trim()

const STRONGS_TAG = /<S>(\d+)<\/S>/g
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

  const recordTag = (strongs: string): void => {
    const lastTag = tags.length > 0 ? tags[tags.length - 1] : undefined
    const wordStart = text.lastIndexOf(' ') + 1
    if (wordStart < text.length) {
      tags.push({ start: wordStart, end: text.length, strongs: [strongs] })
      return
    }
    text = text.trimEnd()
    if (lastTag !== undefined && lastTag.end === text.length)
      lastTag.strongs.push(strongs)
  }

  const cleaned = stripInertMarkup(raw)
  let cursor = 0
  for (const match of cleaned.matchAll(STRONGS_TAG)) {
    appendCollapsed(cleaned.slice(cursor, match.index))
    recordTag(strongsNumber(book, match[1]))
    cursor = match.index + match[0].length
  }
  appendCollapsed(cleaned.slice(cursor))
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
