import type {
  BookContent,
  FormatSpan,
  Heading,
  ModuleManifest,
  VerseContent,
} from '../modules'
import {
  verseHeadingsOf,
  verseLinesOf,
  verseRedLetterOf,
  verseRefsOf,
  verseSuppliedOf,
  verseTagsOf,
  verseTextOf,
} from '../modules'
import {
  enumerateVerseIds,
  redLetterCueOf,
  type Reference,
  type VerseRange,
} from '../reference'
import { derivedRedSpan } from './derived-red-span'

export type VerseSegment = {
  text: string
  redLetter: boolean
  supplied?: boolean
  strongs?: string[]
  lineBreakBefore?: boolean
  lineStart?: boolean
  indent?: number
  psalmHeading?: boolean
  highlightSlot?: number
  // Set on the words an entry asked the reader to emphasize — a search hit's
  // matched words, which live only as long as the entry banner does.
  emphasized?: boolean
  // The passage this stretch of text cites, when it is a book's ref span
  // (spec-books §8) — the reader turns it into a link.
  refs?: VerseRange[]
}

export type PassageVerse = {
  verseId: number
  segments: VerseSegment[]
  hasLineData?: boolean
  startsParagraph?: boolean
  // Book paragraphs only: the section furniture printed above this atom.
  headings?: Heading[]
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

export const verseSegments = (
  verse: VerseContent,
  redSpans: FormatSpan[],
): VerseSegment[] => {
  const text = verseTextOf(verse)
  const orderedTags = [...verseTagsOf(verse)].sort((a, b) => a.start - b.start)
  const suppliedSpans = verseSuppliedOf(verse)
  const refSpans = verseRefsOf(verse)
  const lines = [...verseLinesOf(verse)]
    .filter((line) => line.start < text.length)
    .sort((a, b) => a.start - b.start)
  const cuts = new Set([0, text.length, ...lines.map((line) => line.start)])
  for (const span of [
    ...orderedTags,
    ...redSpans,
    ...suppliedSpans,
    ...refSpans,
  ]) {
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
    const ref = refSpans.find(
      (candidate) => candidate.start <= start && end <= candidate.end,
    )
    if (ref !== undefined) segment.refs = ref.ranges
    const line = [...lines]
      .reverse()
      .find((candidate) => candidate.start <= start)
    if (line !== undefined) {
      if (line.start === start) {
        segment.lineStart = true
        if (start > 0) segment.lineBreakBefore = true
      }
      if (line.indent !== undefined) segment.indent = line.indent
      if (line.psalmHeading === true) segment.psalmHeading = true
    }
    segments.push(segment)
  }
  return segments.length > 0 ? segments : [{ text: '', redLetter: false }]
}

const attributionFor = (manifest: ModuleManifest): string | null => {
  const license = manifest.license.trim()
  if (license === '' || /^public domain$/i.test(license)) return null
  return license
}

export type ModulePassageOptions = {
  derivedRedLetter?: () => boolean
}

export class ModulePassageSource implements PassageSource {
  constructor(
    private readonly store: PassageStore,
    private readonly options: ModulePassageOptions = {},
  ) {}

  async passage(
    reference: Reference,
    translationId: string,
  ): Promise<Passage> {
    const manifest = await this.store.manifest(translationId)
    if (manifest === null) return { status: 'unavailable' }
    const deriveRed =
      this.options.derivedRedLetter?.() === true &&
      manifest.capabilities.redLetter !== true
    const content =
      (await this.store.bookContent(translationId, reference.book)) ?? {}
    const verses: PassageVerse[] = []
    for (const range of reference.ranges) {
      for (const verseId of enumerateVerseIds(range)) {
        const verse = content[verseId]
        if (verse === undefined) continue
        const derived = deriveRed
          ? derivedRedSpan(verseTextOf(verse), redLetterCueOf(verseId))
          : null
        const passageVerse: PassageVerse = {
          verseId,
          segments: verseSegments(
            verse,
            derived !== null ? [derived] : verseRedLetterOf(verse),
          ),
        }
        const headings = verseHeadingsOf(verse)
        if (headings.length > 0) passageVerse.headings = headings
        const lines = verseLinesOf(verse)
        if (lines.length > 0) passageVerse.hasLineData = true
        if (lines.some((line) => line.start === 0 && line.paragraph === true))
          passageVerse.startsParagraph = true
        verses.push(passageVerse)
      }
    }
    if (verses.length === 0) return { status: 'unavailable' }
    return { status: 'ok', verses, attribution: attributionFor(manifest) }
  }
}
