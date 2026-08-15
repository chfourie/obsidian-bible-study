import { parseReference } from '../reference'
import type { Occurrence } from './occurrence'

export type ExtractedOccurrence = Omit<Occurrence, 'file'>

export const extractOccurrences = (
  content: string,
  frontmatterRef: string | null,
): ExtractedOccurrence[] => {
  void frontmatterRef
  const occurrences: ExtractedOccurrence[] = []
  let cursor = 0
  while (cursor < content.length) {
    const open = content.indexOf('{', cursor)
    if (open === -1) break
    const close = content.indexOf('}', open + 1)
    if (close === -1) break
    const parsed = parseReference(content.slice(open + 1, close))
    if (parsed) {
      occurrences.push({
        position: open,
        reference: parsed.reference,
        source: 'body',
      })
      cursor = close + 1
    } else {
      cursor = open + 1
    }
  }
  return occurrences
}
