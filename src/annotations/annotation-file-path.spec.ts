import { describe, expect, it } from 'vitest'
import { ref } from '../../tests/fixtures/reference'
import { annotationFilePath } from './annotation-file-path'

describe('annotationFilePath', () => {
  it('names the note after the canonical ref with colons as periods', () => {
    expect(annotationFilePath('Annotations', ref('John 15:4-6,9'), () => false)).toBe(
      'Annotations/John 15.4-6,9.md',
    )
  })

  it('canonicalizes the ref before naming', () => {
    expect(annotationFilePath('Annotations', ref('jhn 15:4'), () => false)).toBe(
      'Annotations/John 15.4.md',
    )
  })

  it('suffixes colliding names with 1, 2, …', () => {
    const taken = new Set(['Annotations/John 15.4.md', 'Annotations/John 15.4 1.md'])

    expect(
      annotationFilePath('Annotations', ref('John 15:4'), (path) => taken.has(path)),
    ).toBe('Annotations/John 15.4 2.md')
  })

  it('places the note in the configured folder', () => {
    expect(annotationFilePath('Bible/Notes', ref('John 15:4'), () => false)).toBe(
      'Bible/Notes/John 15.4.md',
    )
  })
})
