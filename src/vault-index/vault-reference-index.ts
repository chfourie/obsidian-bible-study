import { referencesIntersect, type Reference } from '../reference'
import {
  extractNote,
  type CrossReferenceDeclaration,
} from './extract-occurrences'
import type { Occurrence } from './occurrence'

export type OccurrenceGroup = {
  file: string
  // The annotation's declared subject — its frontmatter reference — carried
  // even when that reference itself lies outside the queried scope. Null for
  // plain mentions.
  annotationReference: Reference | null
  // Null unless the note declares itself a cross-reference (ADR 0015),
  // carried whole: every parseable member in frontmatter order, whether or
  // not each lies in the queried scope.
  crossReference: CrossReferenceDeclaration | null
  occurrences: Occurrence[]
}

type Classified = {
  annotationReference: Reference | null
  crossReference: CrossReferenceDeclaration | null
}

// What makes a group an annotation is exactly that it declares a subject.
export const isAnnotation = (group: Classified): boolean =>
  group.annotationReference !== null

export const isCrossReference = (group: Classified): boolean =>
  group.crossReference !== null

// A mention is derived, never declared: whatever a note declares in its
// frontmatter takes it out of the mentions (CONTEXT.md — Mention).
export const isMention = (group: Classified): boolean =>
  !isAnnotation(group) && !isCrossReference(group)

type IndexedNote = {
  occurrences: Occurrence[]
  crossReference: CrossReferenceDeclaration | null
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

const declaresInFrontmatter = (occurrences: Occurrence[]): boolean =>
  occurrences.some((occurrence) => occurrence.source !== 'body')

// Members are compared through the occurrences; what is left to compare is
// the summary and the body flag.
const sameDeclaration = (
  a: CrossReferenceDeclaration | null,
  b: CrossReferenceDeclaration | null,
): boolean =>
  a === null || b === null
    ? a === b
    : a.summary === b.summary && a.hasBody === b.hasBody

export class VaultReferenceIndex {
  readonly #notesByFile = new Map<string, IndexedNote>()
  readonly #changeListeners = new Set<() => void>()

  onChanged(listener: () => void): () => void {
    this.#changeListeners.add(listener)
    return () => this.#changeListeners.delete(listener)
  }

  #notifyChanged(): void {
    this.#changeListeners.forEach((listener) => listener())
  }

  indexNote(file: string, content: string): void {
    const extracted = extractNote(content)
    const occurrences = extracted.occurrences.map(
      ({ position, reference, source }) => ({ position, reference, source, file }),
    )
    const previous = this.#notesByFile.get(file)
    // Notes declaring themselves in frontmatter always notify: a body-only
    // edit leaves occurrences unchanged but the reader renders an
    // annotation's body and the panel flags a cross-reference's (spec §5,
    // §5a — modify events refresh on save).
    if (
      !declaresInFrontmatter(occurrences) &&
      sameOccurrences(previous?.occurrences ?? [], occurrences) &&
      sameDeclaration(previous?.crossReference ?? null, extracted.crossReference)
    )
      return
    // A declared cross-reference stays indexed even with no member it can
    // parse (spec §5a), so a later edit finds it and reports the change.
    if (occurrences.length > 0 || extracted.crossReference !== null)
      this.#notesByFile.set(file, {
        occurrences,
        crossReference: extracted.crossReference,
      })
    else this.#notesByFile.delete(file)
    this.#notifyChanged()
  }

  removeNote(file: string): void {
    if (!this.#notesByFile.delete(file)) return
    this.#notifyChanged()
  }

  renameNote(oldPath: string, newPath: string): void {
    const note = this.#notesByFile.get(oldPath)
    if (!note) return
    this.#notesByFile.delete(oldPath)
    this.#notesByFile.set(newPath, {
      ...note,
      occurrences: note.occurrences.map((occurrence) => ({
        ...occurrence,
        file: newPath,
      })),
    })
    this.#notifyChanged()
  }

  intersectingOccurrences(reference: Reference): OccurrenceGroup[] {
    const groups: OccurrenceGroup[] = []
    for (const note of this.#notesByFile.values()) {
      const intersecting = note.occurrences.filter((occurrence) =>
        referencesIntersect(occurrence.reference, reference),
      )
      if (intersecting.length === 0) continue
      // Classification is file-scoped: any frontmatter declaration makes the
      // file an annotation or cross-reference, even when only its body
      // intersects the query.
      const frontmatter = note.occurrences.find(
        (occurrence) => occurrence.source === 'annotation-frontmatter',
      )
      groups.push({
        file: intersecting[0].file,
        annotationReference: frontmatter?.reference ?? null,
        crossReference: note.crossReference,
        occurrences: intersecting,
      })
    }
    return groups.sort(
      (a, b) =>
        Number(isAnnotation(b)) - Number(isAnnotation(a)) ||
        a.file.localeCompare(b.file),
    )
  }
}
