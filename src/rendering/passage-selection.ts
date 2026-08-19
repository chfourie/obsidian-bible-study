import type { HighlightRange } from '../highlights'

export const VERSE_TEXT_CLASS = 'scripture-study-verse-text'

type VerseTextNode = {
  verseId: number
  offset: number
  node: Text
}

// Only the verse text carries offsets: verse numbers, the chip, the fallback
// notice, and the attribution live outside these holders, so a stray drag over
// them contributes nothing and the selection clamps to the passage.
const verseTextNodes = (host: HTMLElement): VerseTextNode[] => {
  const nodes: VerseTextNode[] = []
  for (const holder of host.querySelectorAll<HTMLElement>('[data-verse-id]')) {
    const verseId = Number(holder.dataset.verseId)
    if (!Number.isFinite(verseId)) continue
    const walker = holder.ownerDocument.createTreeWalker(
      holder,
      NodeFilter.SHOW_TEXT,
    )
    let offset = 0
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = node as Text
      nodes.push({ verseId, offset, node: text })
      offset += text.length
    }
  }
  return nodes
}

type SelectedText = VerseTextNode & { start: number; end: number }

const selectedPart = (
  range: Range,
  entry: VerseTextNode,
): SelectedText | null => {
  if (!range.intersectsNode(entry.node)) return null
  const start = entry.node === range.startContainer ? range.startOffset : 0
  const end =
    entry.node === range.endContainer ? range.endOffset : entry.node.length
  return end > start ? { ...entry, start, end } : null
}

export const passageSelectionRange = (
  host: HTMLElement,
  range: Range,
): HighlightRange | null => {
  if (range.collapsed) return null
  const selected = verseTextNodes(host)
    .map((entry) => selectedPart(range, entry))
    .filter((part): part is SelectedText => part !== null)
  if (selected.length === 0) return null

  const first = selected[0]
  const last = selected[selected.length - 1]
  return {
    startVerseId: first.verseId,
    startChar: first.offset + first.start,
    endVerseId: last.verseId,
    endChar: last.offset + last.end,
  }
}
