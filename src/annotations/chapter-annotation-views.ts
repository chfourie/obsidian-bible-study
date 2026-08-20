import type { ChapterAnnotationView } from '../contracts'
import type { AnnotationOrdering } from '../data-access'
import { formatReference, type Reference, type VerseRange } from '../reference'
import type { AnnotationDetails } from './annotation-details'
import {
  orderChapterAnnotations,
  type ChapterAnnotationItem,
} from './order-chapter-annotations'

// The slice of an intersection-query group the annotation pipeline reads.
export type ChapterAnnotationSource = {
  file: string
  annotationReference: Reference | null
  occurrences: readonly { reference: Reference }[]
}

export type LoadedChapterAnnotation = ChapterAnnotationItem & { body: string }

// Reads the details of every annotation among the groups. Groups without a
// declared frontmatter reference are plain mentions, and an annotation whose
// note no longer loads has nothing to show — both drop out.
export const loadChapterAnnotations = async (
  groups: readonly ChapterAnnotationSource[],
  annotationDetails: (file: string) => Promise<AnnotationDetails | null>,
): Promise<LoadedChapterAnnotation[]> => {
  const items = await Promise.all(
    groups.map(async (group) => {
      const reference = group.annotationReference
      if (reference === null) return null
      const details = await annotationDetails(group.file)
      if (details === null) return null
      return {
        file: group.file,
        created: details.created,
        reference,
        intersecting: group.occurrences.map(
          (occurrence) => occurrence.reference,
        ),
        body: details.body,
      }
    }),
  )
  return items.filter((item) => item !== null)
}

// Shapes loaded annotations for display: ordered for the scope, each labelled
// by the reference its frontmatter declares. Pure, so a surface can re-shape
// what it already loaded when the ordering setting changes.
export const chapterAnnotationViews = (
  items: readonly LoadedChapterAnnotation[],
  scope: readonly VerseRange[],
  ordering: AnnotationOrdering,
): ChapterAnnotationView[] =>
  orderChapterAnnotations(items, scope, ordering).map(
    ({ file, reference, body }) => ({
      file,
      label: formatReference(reference),
      body,
    }),
  )
