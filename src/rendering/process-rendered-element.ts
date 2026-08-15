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

export const escapedReferenceInners = (source: string): string[] =>
  [...source.matchAll(CANDIDATE_PATTERN)]
    .filter((match) => match[0].startsWith('\\'))
    .map((match) => match[1])

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

class EscapedInners {
  readonly #remaining = new Map<string, number>()

  constructor(inners: readonly string[]) {
    for (const inner of inners) {
      this.#remaining.set(inner, (this.#remaining.get(inner) ?? 0) + 1)
    }
  }

  consume(inner: string): boolean {
    const count = this.#remaining.get(inner) ?? 0
    if (count === 0) return false
    this.#remaining.set(inner, count - 1)
    return true
  }
}

const processTextNode = (
  node: Text,
  context: RenderContext,
  deps: ReferenceRenderDeps,
  escaped: EscapedInners,
): Promise<void>[] => {
  const text = node.textContent ?? ''
  const document = node.ownerDocument
  const fragment = document.createDocumentFragment()
  const renders: Promise<void>[] = []
  let consumed = 0
  for (const match of text.matchAll(CANDIDATE_PATTERN)) {
    const [candidate, inner] = match
    if (candidate.startsWith('\\')) {
      fragment.appendChild(
        document.createTextNode(text.slice(consumed, match.index)),
      )
      fragment.appendChild(document.createTextNode(candidate.slice(1)))
      consumed = match.index + candidate.length
      continue
    }
    const model = buildReferenceRenderModel(inner, context)
    if (!model || escaped.consume(inner)) continue
    fragment.appendChild(
      document.createTextNode(text.slice(consumed, match.index)),
    )
    const holder = document.createElement('span')
    holder.className = 'bible-study-reference'
    renders.push(renderReference(holder, model, deps))
    fragment.appendChild(holder)
    consumed = match.index + candidate.length
  }
  if (consumed === 0) return renders
  fragment.appendChild(document.createTextNode(text.slice(consumed)))
  node.replaceWith(fragment)
  return renders
}

export const processRenderedElement = async (
  root: HTMLElement,
  context: RenderContext,
  deps: ReferenceRenderDeps,
  escapedInners: readonly string[] = [],
): Promise<void> => {
  const escaped = new EscapedInners(escapedInners)
  const renders = textNodesUnder(root).flatMap((node) =>
    processTextNode(node, context, deps, escaped),
  )
  await Promise.all(renders)
}
