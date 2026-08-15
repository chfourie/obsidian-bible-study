import { referencesIntersect, type Reference } from '../reference'
import { extractOccurrences } from './extract-occurrences'
import type { Occurrence } from './occurrence'

export type OccurrenceGroup = {
  file: string
  annotation: boolean
  occurrences: Occurrence[]
}

const sameReference = (a: Reference, b: Reference): boolean =>
  a.book === b.book &&
  a.ranges.length === b.ranges.length &&
  a.ranges.every(
    (range, index) =>
      range.startId === b.ranges[index].startId &&
      range.endId === b.ranges[index].endId,
  )

const sameOccurrences = (a: Occurrence[], b: Occurrence[]): boolean =>
  a.length === b.length &&
  a.every(
    (occurrence, index) =>
      occurrence.file === b[index].file &&
      occurrence.position === b[index].position &&
      occurrence.source === b[index].source &&
      sameReference(occurrence.reference, b[index].reference),
  )

export class VaultReferenceIndex {
  readonly #occurrencesByFile = new Map<string, Occurrence[]>()
  readonly #changeListeners = new Set<() => void>()

  onChanged(listener: () => void): () => void {
    this.#changeListeners.add(listener)
    return () => this.#changeListeners.delete(listener)
  }

  #notifyChanged(): void {
    this.#changeListeners.forEach((listener) => listener())
  }

  indexNote(file: string, content: string): void {
    const occurrences = extractOccurrences(content).map((occurrence) => ({
      ...occurrence,
      file,
    }))
    const previous = this.#occurrencesByFile.get(file) ?? []
    if (sameOccurrences(previous, occurrences)) return
    if (occurrences.length > 0) this.#occurrencesByFile.set(file, occurrences)
    else this.#occurrencesByFile.delete(file)
    this.#notifyChanged()
  }

  removeNote(file: string): void {
    if (!this.#occurrencesByFile.delete(file)) return
    this.#notifyChanged()
  }

  renameNote(oldPath: string, newPath: string): void {
    const occurrences = this.#occurrencesByFile.get(oldPath)
    if (!occurrences) return
    this.#occurrencesByFile.delete(oldPath)
    this.#occurrencesByFile.set(
      newPath,
      occurrences.map((occurrence) => ({ ...occurrence, file: newPath })),
    )
    this.#notifyChanged()
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
