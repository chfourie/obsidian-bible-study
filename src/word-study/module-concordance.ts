import {
  familySpans,
  isTranslationManifest,
  verseTextOf,
  type ModuleStore,
  type VerseContent,
} from '../modules'
import { decodeVerseId } from '../reference'
import type {
  ConcordanceSegment,
  ConcordanceVerse,
  WordStudyConcordance,
} from './word-study-model'

const segmentsOf = (
  content: VerseContent,
  strongsNumber: string,
): ConcordanceSegment[] => {
  const text = verseTextOf(content)
  const segments: ConcordanceSegment[] = []
  let read = 0
  for (const span of familySpans(content, strongsNumber)) {
    if (span.start > read)
      segments.push({ text: text.slice(read, span.start), emphasis: false })
    segments.push({ text: text.slice(span.start, span.end), emphasis: true })
    read = span.end
  }
  if (read < text.length)
    segments.push({ text: text.slice(read), emphasis: false })
  return segments
}

const byBook = (verseIds: number[]): Map<number, number[]> => {
  const books = new Map<number, number[]>()
  for (const verseId of verseIds) {
    const book = decodeVerseId(verseId).book
    books.set(book, [...(books.get(book) ?? []), verseId])
  }
  return books
}

// The Word Study Panel's concordance, served out of the installed modules: the
// Concordance Index answers which verses, and each occurrence's rendering is
// re-derived from that verse's own tag spans as it is asked for.
export const moduleConcordance = (store: ModuleStore): WordStudyConcordance => ({
  translationFor: async (preferredId) => {
    const tagged = (await store.installedManifests())
      .filter(isTranslationManifest)
      .filter((manifest) => manifest.capabilities.strongsTagged)
    const chosen =
      tagged.find((manifest) => manifest.id === preferredId) ?? tagged[0]
    return chosen === undefined ? null : { id: chosen.id, name: chosen.name }
  },

  occurrences: (translationId, strongsNumber) =>
    store.occurrences(translationId, strongsNumber),

  versesFor: async (translationId, strongsNumber, verseIds) => {
    const verses: ConcordanceVerse[] = []
    for (const [book, ids] of byBook(verseIds)) {
      const content = await store.bookContent(translationId, book)
      if (content === null) continue
      for (const verseId of ids) {
        const verse = content[verseId]
        if (verse === undefined) continue
        verses.push({ verseId, segments: segmentsOf(verse, strongsNumber) })
      }
    }
    return verses
  },
})
