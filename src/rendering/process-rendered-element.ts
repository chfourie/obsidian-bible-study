import {
  bodyLines,
  maskInlineCodeSpans,
  scanReferenceMatches,
  type ReferenceMatch,
} from '../reference'
import {
  buildReferenceRenderModel,
  modelFromParsed,
  type ReferenceRenderModel,
  type RenderContext,
} from './reference-render-model'
import {
  renderReference,
  type ReferenceRenderDeps,
} from './render-reference'
import {
  CLOSING_MARK,
  nextChristQuoteOpening,
  scanChristQuoteCandidates,
  type ChristQuoteCandidate,
  type ChristQuoteMark,
} from './scan-christ-quotes'

export type RenderedSection = {
  noteSource: string
  lineStart: number
  lineEnd: number
}

export const EMPTY_SECTION: RenderedSection = {
  noteSource: '',
  lineStart: 0,
  lineEnd: -1,
}

export const wholeNoteSection = (noteSource: string): RenderedSection => ({
  noteSource,
  lineStart: 0,
  lineEnd: Number.POSITIVE_INFINITY,
})

const CANDIDATE_PATTERN = /\\?\{([^{}\n]*)\}/g

const EXEMPT_SELECTOR = 'code, pre'

const RED_LETTER_CLASS = 'scripture-study-red-letter'

const textNodesUnder = (root: HTMLElement): Text[] => {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement
    if (parent && parent.closest(EXEMPT_SELECTOR)) continue
    nodes.push(node as Text)
  }
  return nodes
}

export class NoteScanCache {
  #last: {
    noteSource: string
    translationKey: string
    matches: ReferenceMatch[]
  } | null = null

  #lastQuotes: {
    noteSource: string
    candidates: ChristQuoteCandidate[]
  } | null = null

  christQuoteCandidates(noteSource: string): ChristQuoteCandidate[] {
    if (this.#lastQuotes?.noteSource !== noteSource) {
      this.#lastQuotes = {
        noteSource,
        candidates: scanChristQuoteCandidates(noteSource),
      }
    }
    return this.#lastQuotes.candidates
  }

  matches(
    noteSource: string,
    translationIds: readonly string[],
  ): ReferenceMatch[] {
    const translationKey = translationIds.join(' ')
    if (
      this.#last?.noteSource !== noteSource ||
      this.#last.translationKey !== translationKey
    ) {
      this.#last = {
        noteSource,
        translationKey,
        matches: scanReferenceMatches(noteSource, { translationIds }),
      }
    }
    return this.#last.matches
  }
}

type SourceCandidate = {
  escaped: boolean
  match: ReferenceMatch | null
}

class OccurrenceQueue<Key, Occurrence> {
  readonly #byKey = new Map<Key, Occurrence[]>()

  push(key: Key, occurrence: Occurrence): void {
    const queued = this.#byKey.get(key) ?? []
    queued.push(occurrence)
    this.#byKey.set(key, queued)
  }

  consumeNext(key: Key): Occurrence | undefined {
    return this.#byKey.get(key)?.shift()
  }
}

// Source candidates per inner text, in section order. Markdown rendering
// swallows the escape backslash, so the DOM alone cannot tell an escaped
// occurrence from a genuine one, nor resolve a relative reference; matching
// each rendered occurrence against the source positionally (per inner text)
// recovers both.
const sectionCandidates = (
  section: RenderedSection,
  context: RenderContext,
  scans: NoteScanCache,
): OccurrenceQueue<string, SourceCandidate> => {
  const queue = new OccurrenceQueue<string, SourceCandidate>()
  const matchesByStart = new Map(
    scans
      .matches(section.noteSource, context.knownTranslationIds)
      .map((match) => [match.start, match]),
  )
  const sectionLines = bodyLines(section.noteSource).filter(
    (line) => line.index >= section.lineStart && line.index <= section.lineEnd,
  )
  for (const line of sectionLines) {
    for (const match of maskInlineCodeSpans(line.text).matchAll(
      CANDIDATE_PATTERN,
    )) {
      const escaped = match[0].startsWith('\\')
      const braceStart = line.start + match.index + (escaped ? 1 : 0)
      queue.push(match[1], {
        escaped,
        match: matchesByStart.get(braceStart) ?? null,
      })
    }
  }
  return queue
}

// Source candidates per opening-mark kind, in section order; the rendered
// text keeps the c and the mark but loses the escape backslash and every
// paragraph edge, so the source says which occurrences are quotes at all.
// Inline markup can split a word so that a rendered node starts mid-word,
// which is why an occurrence the source never saw is no quote either.
class SectionQuoteCandidates {
  readonly #byMark = new OccurrenceQueue<
    ChristQuoteMark,
    ChristQuoteCandidate
  >()
  readonly #sourceSupplied: boolean

  constructor(section: RenderedSection, scans: NoteScanCache) {
    this.#sourceSupplied = section.noteSource !== ''
    for (const candidate of scans.christQuoteCandidates(section.noteSource)) {
      if (
        candidate.lineIndex >= section.lineStart &&
        candidate.lineIndex <= section.lineEnd
      ) {
        this.#byMark.push(candidate.mark, candidate)
      }
    }
  }

  nextOccurrenceIsQuote(mark: ChristQuoteMark): boolean {
    const candidate = this.#byMark.consumeNext(mark)
    if (candidate === undefined) return !this.#sourceSupplied
    return !candidate.escaped && candidate.close !== null
  }
}

type TextPoint = { node: Text; offset: number }

// The wrap is a DOM range so a quote whose marks sit in different sibling
// nodes can be wrapped the same way.
const wrapChristQuote = (open: TextPoint, close: TextPoint): HTMLElement => {
  const range = open.node.ownerDocument.createRange()
  range.setStart(open.node, open.offset)
  range.setEnd(close.node, close.offset + 1)
  const span = createSpan({ cls: RED_LETTER_CLASS })
  range.surroundContents(span)
  return span
}

const decorateChristQuotes = (
  first: Text,
  candidates: SectionQuoteCandidates,
): void => {
  let node = first
  let from = 0
  let opening = nextChristQuoteOpening(node.data, from)
  while (opening) {
    const { prefix, mark, escaped } = opening
    const isQuote = candidates.nextOccurrenceIsQuote(mark) && !escaped
    if (escaped) node.deleteData(prefix + 1, 1)
    const markAt = prefix + 1
    from = markAt
    const close = isQuote
      ? node.data.indexOf(CLOSING_MARK[mark], markAt + 1)
      : -1
    if (close !== -1) {
      node.deleteData(prefix, 1)
      const span = wrapChristQuote(
        { node, offset: prefix },
        { node, offset: close - 1 },
      )
      const rest = span.nextSibling
      // nodeType rather than instanceof Text: a popout window's nodes are
      // not instances of this window's constructors.
      if (rest?.nodeType !== Node.TEXT_NODE) return
      node = rest as Text
      from = 0
    }
    opening = nextChristQuoteOpening(node.data, from)
  }
}

const modelFor = (
  inner: string,
  candidate: SourceCandidate | undefined,
  context: RenderContext,
): ReferenceRenderModel | null => {
  if (candidate === undefined) return buildReferenceRenderModel(inner, context)
  if (candidate.escaped || candidate.match === null) return null
  return modelFromParsed(
    candidate.match.parsed,
    context,
    candidate.match.relativeSpec,
  )
}

const processTextNode = (
  node: Text,
  context: RenderContext,
  deps: ReferenceRenderDeps,
  candidates: OccurrenceQueue<string, SourceCandidate>,
  sourcePath: string | null,
): Promise<void>[] => {
  const text = node.textContent ?? ''
  const parts: (string | HTMLElement)[] = []
  const renders: Promise<void>[] = []
  let consumed = 0
  for (const match of text.matchAll(CANDIDATE_PATTERN)) {
    const [candidate, inner] = match
    const sourceCandidate = candidates.consumeNext(inner)
    if (candidate.startsWith('\\')) {
      parts.push(text.slice(consumed, match.index), candidate.slice(1))
      consumed = match.index + candidate.length
      continue
    }
    const model = modelFor(inner, sourceCandidate, context)
    if (!model) continue
    parts.push(text.slice(consumed, match.index))
    const holder = createSpan({ cls: 'scripture-study-reference' })
    renders.push(renderReference(holder, model, deps, sourcePath))
    parts.push(holder)
    consumed = match.index + candidate.length
  }
  if (consumed === 0) return renders
  parts.push(text.slice(consumed))
  node.before(...parts)
  node.remove()
  return renders
}

export const processRenderedElement = async (
  root: HTMLElement,
  context: RenderContext,
  deps: ReferenceRenderDeps,
  section: RenderedSection = EMPTY_SECTION,
  sourcePath: string | null = null,
  scans: NoteScanCache = new NoteScanCache(),
): Promise<void> => {
  const quoteCandidates = new SectionQuoteCandidates(section, scans)
  for (const node of textNodesUnder(root)) {
    decorateChristQuotes(node, quoteCandidates)
  }
  const candidates = sectionCandidates(section, context, scans)
  const renders = textNodesUnder(root).flatMap((node) =>
    processTextNode(node, context, deps, candidates, sourcePath),
  )
  await Promise.all(renders)
}
