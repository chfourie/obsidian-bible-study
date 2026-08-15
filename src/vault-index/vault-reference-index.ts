import { referencesIntersect, type Reference } from '../reference'
import { extractOccurrences } from './extract-occurrences'
import type { Occurrence } from './occurrence'

export type OccurrenceGroup = {
  file: string
  annotation: boolean
  occurrences: Occurrence[]
}

export class VaultReferenceIndex {
  readonly #occurrencesByFile = new Map<string, Occurrence[]>()

  indexNote(file: string, content: string, frontmatterRef: string | null): void {
    const occurrences = extractOccurrences(content, frontmatterRef).map(
      (occurrence) => ({ ...occurrence, file }),
    )
    if (occurrences.length > 0) this.#occurrencesByFile.set(file, occurrences)
    else this.#occurrencesByFile.delete(file)
  }

  removeNote(file: string): void {
    this.#occurrencesByFile.delete(file)
  }

  renameNote(oldPath: string, newPath: string): void {
    const occurrences = this.#occurrencesByFile.get(oldPath)
    if (!occurrences) return
    this.#occurrencesByFile.delete(oldPath)
    this.#occurrencesByFile.set(
      newPath,
      occurrences.map((occurrence) => ({ ...occurrence, file: newPath })),
    )
  }

  intersectingOccurrences(reference: Reference): OccurrenceGroup[] {
    const groups: OccurrenceGroup[] = []
    for (const occurrences of this.#occurrencesByFile.values()) {
      const intersecting = occurrences.filter((occurrence) =>
        referencesIntersect(occurrence.reference, reference),
      )
      if (intersecting.length === 0) continue
      groups.push({
        file: intersecting[0].file,
        annotation: intersecting.some(
          (occurrence) => occurrence.source === 'annotation-frontmatter',
        ),
        occurrences: intersecting,
      })
    }
    return groups.sort(
      (a, b) =>
        Number(b.annotation) - Number(a.annotation) ||
        a.file.localeCompare(b.file),
    )
  }
}
