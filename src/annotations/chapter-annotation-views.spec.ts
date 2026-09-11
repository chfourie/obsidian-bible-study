import { describe, expect, it } from 'vitest'
import { parseReference, type Reference } from '../reference'
import { chapterAnnotationViews } from './chapter-annotation-views'

const ref = (text: string): Reference => {
  const parsed = parseReference(text, { translationIds: [] })
  if (parsed === null) throw new Error(`unparseable reference: ${text}`)
  return parsed.reference
}

const scope = ref('John 15').ranges

const loaded = (file: string, reference: string, body: string) => ({
  file,
  created: 0,
  reference: ref(reference),
  intersecting: [],
  body,
})

describe('chapterAnnotationViews', () => {
  it('labels each annotation by the reference its frontmatter declares', () => {
    const views = chapterAnnotationViews(
      [loaded('Annotations/Vine.md', 'John 15:1', 'The vine is Christ.')],
      scope,
      'created-oldest-first',
    )

    expect(views).toEqual([
      {
        file: 'Annotations/Vine.md',
        label: 'John 15:1',
        title: 'Vine',
        body: 'The vine is Christ.',
      },
    ])
  })

  it('titles each annotation by its note name, so two annotations on one address are told apart', () => {
    const views = chapterAnnotationViews(
      [
        loaded('Annotations/The Vine.md', 'John 15:1', 'First'),
        loaded('Sermons/2024/Abiding in Him.md', 'John 15:1', 'Second'),
      ],
      scope,
      'path-a-z',
    )

    expect(views.map((view) => view.title)).toEqual([
      'The Vine',
      'Abiding in Him',
    ])
  })
})
