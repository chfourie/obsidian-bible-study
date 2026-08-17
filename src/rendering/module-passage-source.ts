import type {
  BookContent,
  FormatSpan,
  ModuleManifest,
  VerseContent,
} from '../modules'
import {
  verseLinesOf,
  verseRedLetterOf,
  verseSuppliedOf,
  verseTagsOf,
  verseTextOf,
} from '../modules'
import { enumerateVerseIds, type Reference } from '../reference'

export type VerseSegment = {
  text: string
  redLetter: boolean
  supplied?: boolean
  strongs?: string[]
  lineBreakBefore?: boolean
}

export type PassageVerse = {
  verseId: number
  segments: VerseSegment[]
  hasLineData?: boolean
}

export type FallbackSubstitution = {
  requested: string
  served: string
}

export type Passage =
  | {
      status: 'ok'
      verses: PassageVerse[]
      attribution: string | null
      fallback?: FallbackSubstitution
    }
  | { status: 'unavailable' }

export interface PassageSource {
  passage(reference: Reference, translationId: string): Promise<Passage>
}

export type PassageStore = {
  manifest(moduleId: string): Promise<ModuleManifest | null>
  bookContent(moduleId: string, book: number): Promise<BookContent | null>
}

const covering = (
  spans: FormatSpan[],
  start: number,
  end: number,
): boolean =>
  spans.some((span) => span.start <= start && end <= span.end)

const verseSegments = (verse: VerseContent): VerseSegment[] => {
  const text = verseTextOf(verse)
  const orderedTags = [...verseTagsOf(verse)].sort((a, b) => a.start - b.start)
  const redSpans = verseRedLetterOf(verse)
  const suppliedSpans = verseSuppliedOf(verse)
  const lineStarts = new Set(
    verseLinesOf(verse)
      .map((line) => line.start)
      .filter((start) => start > 0 && start < text.length),
  )
  const cuts = new Set([0, text.length, ...lineStarts])
  for (const span of [...orderedTags, ...redSpans, ...suppliedSpans]) {
    cuts.add(span.start)
    cuts.add(span.end)
  }
  const ordered = [...cuts].sort((a, b) => a - b)
  const segments: VerseSegment[] = []
  for (let index = 0; index < ordered.length - 1; index++) {
    const start = ordered[index]
    const end = ordered[index + 1]
    const tag = orderedTags.find(
      (candidate) => candidate.start <= start && end <= candidate.end,
    )
    const segment: VerseSegment = {
      text: text.slice(start, end),
      redLetter: covering(redSpans, start, end),
    }
    if (covering(suppliedSpans, start, end)) segment.supplied = true
    if (tag !== undefined) segment.strongs = tag.strongs
    if (lineStarts.has(start)) segment.lineBreakBefore = true
    segments.push(segment)
  }
  return segments.length > 0 ? segments : [{ text: '', redLetter: false }]
}

const attributionFor = (manifest: ModuleManifest): string | null => {
  const license = manifest.license.trim()
  if (license === '' || /^public domain$/i.test(license)) return null
  return license
}

export class ModulePassageSource implements PassageSource {
  constructor(private readonly store: PassageStore) {}

  async passage(
    reference: Reference,
    translationId: string,
  ): Promise<Passage> {
    const manifest = await this.store.manifest(translationId)
    if (manifest === null) return { status: 'unavailable' }
    const content =
      (await this.store.bookContent(translationId, reference.book)) ?? {}
    const verses: PassageVerse[] = []
    for (const range of reference.ranges) {
      for (const verseId of enumerateVerseIds(range)) {
        const verse = content[verseId]
        if (verse === undefined) continue
        const passageVerse: PassageVerse = {
          verseId,
          segments: verseSegments(verse),
        }
        if (verseLinesOf(verse).length > 0) passageVerse.hasLineData = true
        verses.push(passageVerse)
      }
    }
    if (verses.length === 0) return { status: 'unavailable' }
    return { status: 'ok', verses, attribution: attributionFor(manifest) }
  }
}
