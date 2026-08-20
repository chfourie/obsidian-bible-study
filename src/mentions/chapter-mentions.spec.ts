import { describe, expect, it } from 'vitest'
import { parseReference, type Reference } from '../reference'
import { chapterMentionViews } from './chapter-mentions'

const ref = (text: string): Reference => {
  const parsed = parseReference(text, { translationIds: [] })
  if (parsed === null) throw new Error(`unparseable reference: ${text}`)
  return parsed.reference
}

const chapter = ref('John 15')

const source = (file: string, ...references: string[]) => ({
  file,
  references: references.map(ref),
})

describe('chapterMentionViews', () => {
  it('orders by where each mention first touches the chapter', () => {
    const views = chapterMentionViews(
      [
        source('late.md', 'John 15:9'),
        source('early.md', 'John 15:2'),
        source('middle.md', 'John 15:5-7'),
      ],
      chapter,
    )

    expect(views.map((view) => view.file)).toEqual([
      'early.md',
      'middle.md',
      'late.md',
    ])
  })

  it('ranks a mention by its first range inside the chapter, not ranges elsewhere', () => {
    const views = chapterMentionViews(
      [
        source('spanning.md', 'John 14:1,15:8'),
        source('local.md', 'John 15:3'),
      ],
      chapter,
    )

    expect(views.map((view) => view.file)).toEqual([
      'local.md',
      'spanning.md',
    ])
  })

  it('breaks scripture-position ties by path A-Z', () => {
    const views = chapterMentionViews(
      [source('b.md', 'John 15:4'), source('a.md', 'John 15:4')],
      chapter,
    )

    expect(views.map((view) => view.file)).toEqual(['a.md', 'b.md'])
  })

  it('titles each mention by its note name, not its path', () => {
    const views = chapterMentionViews(
      [source('sermons/vine and branches.md', 'John 15:1')],
      chapter,
    )

    expect(views[0].title).toBe('vine and branches')
  })

  it('labels a mention with its references that intersect the chapter, in scripture order', () => {
    const views = chapterMentionViews(
      [source('study.md', 'John 15:9', 'John 14:6', 'John 15:2')],
      chapter,
    )

    expect(views[0].labels).toEqual(['John 15:2', 'John 15:9'])
  })

  it('collapses repeated references into one label', () => {
    const views = chapterMentionViews(
      [source('study.md', 'John 15:4', 'John 15:4')],
      chapter,
    )

    expect(views[0].labels).toEqual(['John 15:4'])
  })

  it('drops a mention with no reference inside the chapter', () => {
    const views = chapterMentionViews(
      [source('elsewhere.md', 'John 14:1')],
      chapter,
    )

    expect(views).toEqual([])
  })

  it('leaves the given sources untouched', () => {
    const sources = [
      source('late.md', 'John 15:9'),
      source('early.md', 'John 15:2'),
    ]

    chapterMentionViews(sources, chapter)

    expect(sources.map((entry) => entry.file)).toEqual([
      'late.md',
      'early.md',
    ])
  })
})
