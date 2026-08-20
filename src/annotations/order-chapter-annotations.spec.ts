import { describe, expect, it } from 'vitest'
import { parseReference, type Reference } from '../reference'
import { orderChapterAnnotations } from './order-chapter-annotations'

const ref = (text: string): Reference => {
  const parsed = parseReference(text, { translationIds: [] })
  if (parsed === null) throw new Error(`unparseable reference: ${text}`)
  return parsed.reference
}

const chapter = ref('John 15')

const item = (file: string, reference: string, created = 0) => ({
  file,
  created,
  reference: ref(reference),
})

describe('orderChapterAnnotations', () => {
  it('orders by where each annotation first touches the chapter', () => {
    const ordered = orderChapterAnnotations(
      [
        item('late.md', 'John 15:9'),
        item('early.md', 'John 15:2'),
        item('middle.md', 'John 15:5-7'),
      ],
      chapter,
      'created-oldest-first',
    )

    expect(ordered.map((entry) => entry.file)).toEqual([
      'early.md',
      'middle.md',
      'late.md',
    ])
  })

  it('ranks an annotation by its first range inside the chapter, not ranges elsewhere', () => {
    const ordered = orderChapterAnnotations(
      [
        item('spanning.md', 'John 14:1,15:8'),
        item('local.md', 'John 15:3'),
      ],
      chapter,
      'created-oldest-first',
    )

    expect(ordered.map((entry) => entry.file)).toEqual([
      'local.md',
      'spanning.md',
    ])
  })

  it('breaks scripture-position ties by creation time when so configured', () => {
    const ordered = orderChapterAnnotations(
      [
        item('younger.md', 'John 15:4', 200),
        item('older.md', 'John 15:4', 100),
      ],
      chapter,
      'created-oldest-first',
    )

    expect(ordered.map((entry) => entry.file)).toEqual([
      'older.md',
      'younger.md',
    ])
  })

  it('breaks scripture-position ties by path when so configured', () => {
    const ordered = orderChapterAnnotations(
      [
        item('b.md', 'John 15:4', 100),
        item('a.md', 'John 15:4', 200),
      ],
      chapter,
      'path-a-z',
    )

    expect(ordered.map((entry) => entry.file)).toEqual(['a.md', 'b.md'])
  })

  it('leaves the given items untouched', () => {
    const items = [item('late.md', 'John 15:9'), item('early.md', 'John 15:2')]

    orderChapterAnnotations(items, chapter, 'created-oldest-first')

    expect(items.map((entry) => entry.file)).toEqual(['late.md', 'early.md'])
  })
})
