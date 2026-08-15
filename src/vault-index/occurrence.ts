import type { Reference } from '../reference'

export type OccurrenceSource = 'body' | 'annotation-frontmatter'

export type Occurrence = {
  file: string
  position: number
  reference: Reference
  source: OccurrenceSource
}
