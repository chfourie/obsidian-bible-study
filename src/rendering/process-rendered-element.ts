import { maskInlineCodeSpans } from '../reference'
import {
  buildReferenceRenderModel,
  type RenderContext,
} from './reference-render-model'
import {
  renderReference,
  type ReferenceRenderDeps,
} from './render-reference'

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

// Escaped-flag queues per inner text, in source order. Markdown rendering
// swallows the escape backslash, so the DOM alone cannot tell an escaped
// occurrence from a genuine one; matching each rendered occurrence against
// the source positionally (per inner text) recovers which one was escaped.
class SectionEscapes {
  readonly #flagsByInner = new Map<string, boolean[]>()

  constructor(sectionSource: string) {
    for (const line of sectionSource.split('\n')) {
      for (const match of maskInlineCodeSpans(line).matchAll(
        CANDIDATE_PATTERN,
      )) {
        const flags = this.#flagsByInner.get(match[1]) ?? []
        flags.push(match[0].startsWith('\\'))
        this.#flagsByInner.set(match[1], flags)
      }
    }
  }

  consumeNextOccurrence(inner: string): boolean {
    return this.#flagsByInner.get(inner)?.shift() ?? false
  }
}

const processTextNode = (
  node: Text,
  context: RenderContext,
  deps: ReferenceRenderDeps,
  escapes: SectionEscapes,
  sourcePath: string | null,
): Promise<void>[] => {
  const text = node.textContent ?? ''
  const parts: (string | HTMLElement)[] = []
  const renders: Promise<void>[] = []
  let consumed = 0
  for (const match of text.matchAll(CANDIDATE_PATTERN)) {
    const [candidate, inner] = match
    const escapedInSource = escapes.consumeNextOccurrence(inner)
    if (candidate.startsWith('\\')) {
      parts.push(text.slice(consumed, match.index), candidate.slice(1))
      consumed = match.index + candidate.length
      continue
    }
    const model = buildReferenceRenderModel(inner, context)
    if (!model || escapedInSource) continue
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
  sectionSource = '',
  sourcePath: string | null = null,
): Promise<void> => {
  const escapes = new SectionEscapes(sectionSource)
  const renders = textNodesUnder(root).flatMap((node) =>
    processTextNode(node, context, deps, escapes, sourcePath),
  )
  await Promise.all(renders)
}
