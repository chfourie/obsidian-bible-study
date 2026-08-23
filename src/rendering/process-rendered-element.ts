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

// The whole note's source with the rendered section's line span inside it,
// so an Anchor in an earlier section still resolves relative references here.
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

const CANDIDATE_PATTERN = /\\?\{([^{}\n]*)\}/g

const EXEMPT_SELECTOR = 'code, pre'

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

// Every section of one note render scans the same source; the sections
// arrive one after another, so remembering the last scan serves them all.
let lastScan: {
  noteSource: string
  translationKey: string
  matches: ReferenceMatch[]
} | null = null

const noteMatches = (
  noteSource: string,
  translationIds: readonly string[],
): ReferenceMatch[] => {
  const translationKey = translationIds.join(' ')
  if (
    lastScan?.noteSource !== noteSource ||
    lastScan.translationKey !== translationKey
  ) {
    lastScan = {
      noteSource,
      translationKey,
      matches: scanReferenceMatches(noteSource, { translationIds }),
    }
  }
  return lastScan.matches
}

type SourceCandidate = {
  escaped: boolean
  match: ReferenceMatch | null
}

// Source candidates per inner text, in section order. Markdown rendering
// swallows the escape backslash, so the DOM alone cannot tell an escaped
// occurrence from a genuine one, nor resolve a relative reference; matching
// each rendered occurrence against the source positionally (per inner text)
// recovers both.
class SectionCandidates {
  readonly #byInner = new Map<string, SourceCandidate[]>()

  constructor(section: RenderedSection, context: RenderContext) {
    const matchesByStart = new Map(
      noteMatches(section.noteSource, context.knownTranslationIds).map(
        (match) => [match.start, match],
      ),
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
        const candidates = this.#byInner.get(match[1]) ?? []
        candidates.push({
          escaped,
          match: matchesByStart.get(braceStart) ?? null,
        })
        this.#byInner.set(match[1], candidates)
      }
    }
  }

  consumeNextOccurrence(inner: string): SourceCandidate | undefined {
    return this.#byInner.get(inner)?.shift()
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
  candidates: SectionCandidates,
  sourcePath: string | null,
): Promise<void>[] => {
  const text = node.textContent ?? ''
  const parts: (string | HTMLElement)[] = []
  const renders: Promise<void>[] = []
  let consumed = 0
  for (const match of text.matchAll(CANDIDATE_PATTERN)) {
    const [candidate, inner] = match
    const sourceCandidate = candidates.consumeNextOccurrence(inner)
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
): Promise<void> => {
  const candidates = new SectionCandidates(section, context)
  const renders = textNodesUnder(root).flatMap((node) =>
    processTextNode(node, context, deps, candidates, sourcePath),
  )
  await Promise.all(renders)
}
