import {
  familySpans,
  isTranslationManifest,
  strongsFamily,
  verseTextOf,
  type FormatSpan,
  type ModuleStore,
  type VerseContent,
} from '../modules'
import { decodeVerseId } from '../reference'
import type {
  ConcordanceRendering,
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

const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu

// The words one tag span puts on screen, as a chip would name them: the
// surface itself, less whatever punctuation the span happens to run over.
const surfaceOf = (text: string, span: FormatSpan): string =>
  text.slice(span.start, span.end).replace(EDGE_PUNCTUATION, '')

// One rendering as it is being gathered: the verses it stands in, and how
// often each spelling of it was seen, so the chip is named with the commonest.
type GatheredRendering = { verseIds: number[]; forms: Map<string, number> }

const commonestForm = (forms: Map<string, number>): string =>
  [...forms.entries()].reduce((best, form) =>
    form[1] > best[1] ? form : best,
  )[0]

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
export const moduleConcordance = (store: ModuleStore): WordStudyConcordance => {
  // The renderings of one family cost a read of every book it occurs in, so
  // the last family asked for is held — switching a translation back and forth
  // is the move that would otherwise pay for it twice.
  let held: { key: string; renderings: ConcordanceRendering[] } | null = null

  return {
    translations: async () =>
      (await store.installedManifests())
        .filter(isTranslationManifest)
        .filter((manifest) => manifest.capabilities.strongsTagged)
        .map(({ id, name }) => ({ id, name })),

    occurrences: (translationId, strongsNumber) =>
      store.occurrences(translationId, strongsNumber),

    // The translation's own renderings of the family, read off the same tag
    // spans the occurrence rows emphasize: spellings that differ only in case or
    // punctuation are one rendering, named with the commonest of them.
    renderings: async (translationId, strongsNumber) => {
      const verseIds = await store.occurrences(translationId, strongsNumber)
      const key = [
        translationId,
        strongsFamily(strongsNumber),
        verseIds.length,
      ].join(':')
      if (held?.key === key) return held.renderings
      const gathered = new Map<string, GatheredRendering>()
      for (const [book, ids] of byBook(verseIds)) {
        const content = await store.bookContent(translationId, book)
        if (content === null) continue
        for (const verseId of ids) {
          const verse = content[verseId]
          if (verse === undefined) continue
          const text = verseTextOf(verse)
          for (const span of familySpans(verse, strongsNumber)) {
            const form = surfaceOf(text, span)
            if (form === '') continue
            const grouping = form.toLowerCase()
            const rendering = gathered.get(grouping) ?? {
              verseIds: [],
              forms: new Map<string, number>(),
            }
            rendering.forms.set(form, (rendering.forms.get(form) ?? 0) + 1)
            if (rendering.verseIds[rendering.verseIds.length - 1] !== verseId)
              rendering.verseIds.push(verseId)
            gathered.set(grouping, rendering)
          }
        }
      }
      const renderings = [...gathered.values()].map(
        ({ verseIds: ids, forms }) => ({
          text: commonestForm(forms),
          verseIds: ids,
        }),
      )
      held = { key, renderings }
      return renderings
    },

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
  }
}
