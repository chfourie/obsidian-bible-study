import type {
  BookContent,
  BookSection,
  Figure,
  FormatSpan,
  Heading,
  ModuleManifest,
  VerseContent,
  VerseLine,
} from '../modules'
import {
  bookAtomKind,
  verseEmendedOf,
  verseFiguresOf,
  verseFootnotesOf,
  verseHeadingsOf,
  verseLinesOf,
  verseMarksOf,
  verseRedLetterOf,
  verseRefsOf,
  verseSuppliedOf,
  verseTagsOf,
  verseTextOf,
} from '../modules'
import {
  decodeVerseId,
  enumerateVerseIds,
  makeVerseId,
  redLetterCueOf,
  type Reference,
  type VerseRange,
} from '../reference'
import { derivedRedSpan } from './derived-red-span'
import type { TextSpan } from './segment-spans'

export type VerseSegment = {
  text: string
  redLetter: boolean
  supplied?: boolean
  // A critical Book's Editorial marks (spec-books §10): the stretch is a
  // mark glyph, or an emended word. Paint only — the text is the atom's.
  marks?: boolean
  emended?: boolean
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

// One row of a Book atom the curator flattened from a printed table: the
// spans its cells cover in the atom's stored text, and whether the row is the
// table's header row. The text itself stays the flat row a citation reads —
// the grid is drawn from the spans beside it.
export type PassageTableRow = {
  cells: FormatSpan[]
  header: boolean
}

export type PassageVerse = {
  verseId: number
  segments: VerseSegment[]
  hasLineData?: boolean
  // Set only on a table atom: its rows, in order.
  table?: PassageTableRow[]
  startsParagraph?: boolean
  // Book paragraphs only: the section furniture printed with this atom.
  headings?: Heading[]
  figures?: Figure[]
  // The atom's Footnotes in anchor order, for the Study Panel alone: no
  // marker and no body ever prints on the page or in a note (spec-books §6,
  // ADR 0012), so the anchor offset itself never leaves the module.
  footnotes?: string[]
}

// One step of a verse-atom Book's page walk (spec-books §11, ADR 0013): a
// metrical line of an atom that carries `lines`, or the whole of a prose
// atom. `span` is the stretch of the atom's stored text the step prints, so a
// renderer cuts the atom's segments — highlights and marks already on them —
// down to the step and never re-reads the text. The Line letter rides here
// for the number slot; it is never in the text (CONTEXT.md — Line letter).
export type PassageStep = {
  verseId: number
  line?: number
  span: TextSpan
  letter?: string
  // The line opens a stanza or paragraph: `paragraph` on that line.
  startsParagraph?: boolean
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
      // A verse-atom Book's walk over `verses` in the edition's page order —
      // a section's `reading` where it has one, else atoms 1..N with their
      // stored lines — section after section as the reference names them
      // (no walk crosses a section, ADR 0014). Absent for scripture and
      // paragraph Books, which render atom by atom as ever.
      steps?: PassageStep[]
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
  const markSpans = verseMarksOf(verse)
  const emendedSpans = verseEmendedOf(verse)
  const refSpans = verseRefsOf(verse)
  const lines = [...verseLinesOf(verse)]
    .filter((line) => line.start < text.length)
    .sort((a, b) => a.start - b.start)
  const cuts = new Set([0, text.length, ...lines.map((line) => line.start)])
  for (const span of [
    ...orderedTags,
    ...redSpans,
    ...suppliedSpans,
    ...markSpans,
    ...emendedSpans,
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
    if (covering(markSpans, start, end)) segment.marks = true
    if (covering(emendedSpans, start, end)) segment.emended = true
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

// An atom as the walk addresses it: its stored text and lines in stored
// order (ADR 0013).
type WalkedAtom = { verseId: number; text: string; lines: VerseLine[] }

const walkedAtom = (verseId: number, verse: VerseContent): WalkedAtom => ({
  verseId,
  text: verseTextOf(verse),
  lines: verseLinesOf(verse),
})

// A `line` the build should have refused (ADR 0013) is read as the whole
// atom rather than dropped: the text still prints, nothing is invented.
const stepOf = (atom: WalkedAtom, line?: number): PassageStep => {
  const stored = line === undefined ? undefined : atom.lines[line]
  if (line === undefined || stored === undefined)
    return { verseId: atom.verseId, span: { start: 0, end: atom.text.length } }
  const step: PassageStep = {
    verseId: atom.verseId,
    line,
    span: {
      start: stored.start,
      end: atom.lines[line + 1]?.start ?? atom.text.length,
    },
  }
  if (stored.letter !== undefined) step.letter = stored.letter
  if (stored.paragraph === true) step.startsParagraph = true
  return step
}

const atomSteps = (atom: WalkedAtom): PassageStep[] =>
  atom.lines.length === 0
    ? [stepOf(atom)]
    : atom.lines.map((_, line) => stepOf(atom, line))

// The walk over the verses served, section by section as the reference
// names them: a section's `reading` filtered to those verses, or the identity
// walk where the page is the atom order (spec-books §11). A single atom is
// the traditional verse as one reading — 7a 7b 7c in letter order — so only
// a multi-atom reference walks the page (§4, §11).
const passageSteps = (
  book: number,
  verses: readonly PassageVerse[],
  content: BookContent,
  sections: readonly BookSection[],
): PassageStep[] => {
  if (verses.length === 1) {
    const { verseId } = verses[0]
    return atomSteps(walkedAtom(verseId, content[verseId]))
  }
  const chapters = new Map<number, Map<number, WalkedAtom>>()
  for (const { verseId } of verses) {
    const { chapter } = decodeVerseId(verseId)
    const served = chapters.get(chapter) ?? new Map<number, WalkedAtom>()
    served.set(verseId, walkedAtom(verseId, content[verseId]))
    chapters.set(chapter, served)
  }
  return [...chapters].flatMap(([chapter, served]) => {
    const reading = sections.find((section) => section.chapter === chapter)
      ?.reading
    if (reading === undefined) return [...served.values()].flatMap(atomSteps)
    return reading.flatMap(({ atom, line }) => {
      const walked = served.get(makeVerseId(book, chapter, atom))
      return walked === undefined ? [] : [stepOf(walked, line)]
    })
  })
}

// One visit of a walk, for the surfaces that print it: the step, the atom
// it prints, whether the walk enters that atom here (the number prints at
// every entry, spec-books §4) and whether this is the atom's first
// appearance (its furniture prints once).
export type WalkVisit<Atom> = {
  step: PassageStep
  atom: Atom
  entersAtom: boolean
  firstAppearance: boolean
}

export const walkSteps = <Atom extends { verseId: number }>(
  atoms: readonly Atom[],
  steps: readonly PassageStep[],
): WalkVisit<Atom>[] => {
  const byId = new Map(atoms.map((atom) => [atom.verseId, atom]))
  const seen = new Set<number>()
  return steps.flatMap((step, index) => {
    const atom = byId.get(step.verseId)
    if (atom === undefined) return []
    const firstAppearance = !seen.has(step.verseId)
    seen.add(step.verseId)
    return [
      {
        step,
        atom,
        entersAtom: index === 0 || steps[index - 1].verseId !== step.verseId,
        firstAppearance,
      },
    ]
  })
}

// The label a lettered line takes in the number slot, in place of the number
// (spec-books §11): Charles's `6a`.
export const lineLetterLabel = (step: PassageStep): string | null =>
  step.letter === undefined
    ? null
    : `${decodeVerseId(step.verseId).verse}${step.letter}`

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
        const figures = verseFiguresOf(verse)
        if (figures.length > 0) passageVerse.figures = figures
        const footnotes = verseFootnotesOf(verse)
        if (footnotes.length > 0)
          passageVerse.footnotes = footnotes.map((footnote) => footnote.text)
        const lines = verseLinesOf(verse)
        if (lines.length > 0) passageVerse.hasLineData = true
        const rows = lines
          .filter((line) => line.cells !== undefined)
          .map((line) => ({
            cells: line.cells ?? [],
            header: line.header === true,
          }))
        if (rows.length > 0) passageVerse.table = rows
        if (lines.some((line) => line.start === 0 && line.paragraph === true))
          passageVerse.startsParagraph = true
        verses.push(passageVerse)
      }
    }
    if (verses.length === 0) return { status: 'unavailable' }
    const passage: Passage = {
      status: 'ok',
      verses,
      attribution: attributionFor(manifest),
    }
    const book = manifest.book
    if (book !== undefined && bookAtomKind(book) === 'verse')
      passage.steps = passageSteps(
        reference.book,
        verses,
        content,
        book.sections,
      )
    return passage
  }
}
