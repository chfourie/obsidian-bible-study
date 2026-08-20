import { describe, expect, it } from 'vitest'
import { makeVerseId, parseReference, type Reference } from '../reference'
import { verseMarkers } from './verse-markers'

const ref = (text: string): Reference => {
  const parsed = parseReference(text, { translationIds: [] })
  if (parsed === null) throw new Error(`unparseable reference: ${text}`)
  return parsed.reference
}

const chapter = ref('John 15')

const source = (file: string, annotation: boolean, ...references: string[]) => ({
  file,
  annotation,
  references: references.map(ref),
})

const verse = (number: number): number => makeVerseId(43, 15, number)

describe('verseMarkers', () => {
  it('marks only the first verse of a multi-verse range', () => {
    const markers = verseMarkers(
      [source('note.md', true, 'John 15:4-6')],
      chapter,
    )

    expect(markers.get(verse(4))).toEqual({ annotations: 1, mentions: 0 })
    expect(markers.get(verse(5))).toBeUndefined()
    expect(markers.get(verse(6))).toBeUndefined()
  })

  it('marks the start of each range of a multi-range reference', () => {
    const markers = verseMarkers(
      [source('note.md', false, 'John 15:4-6,9')],
      chapter,
    )

    expect(markers.get(verse(4))).toEqual({ annotations: 0, mentions: 1 })
    expect(markers.get(verse(9))).toEqual({ annotations: 0, mentions: 1 })
  })

  it('marks the chapter opening for a range entering from the previous chapter', () => {
    const markers = verseMarkers(
      [source('note.md', false, 'John 14:30-15:3')],
      chapter,
    )

    expect(markers.get(verse(1))).toEqual({ annotations: 0, mentions: 1 })
  })

  it('ignores ranges that never touch the chapter', () => {
    const markers = verseMarkers(
      [source('note.md', false, 'John 14:1,15:7')],
      chapter,
    )

    expect(markers.get(verse(7))).toEqual({ annotations: 0, mentions: 1 })
    expect(markers.size).toBe(1)
  })

  it('counts annotations and mentions separately at the same verse', () => {
    const markers = verseMarkers(
      [
        source('Annotations/a.md', true, 'John 15:4'),
        source('Annotations/b.md', true, 'John 15:4-5'),
        source('Sermons/vine.md', false, 'John 15:4'),
      ],
      chapter,
    )

    expect(markers.get(verse(4))).toEqual({ annotations: 2, mentions: 1 })
  })

  it('counts a note once per verse however many of its references start there', () => {
    const markers = verseMarkers(
      [source('study.md', false, 'John 15:4', 'John 15:4-6')],
      chapter,
    )

    expect(markers.get(verse(4))).toEqual({ annotations: 0, mentions: 1 })
  })

  it('marks every range start a single note contributes', () => {
    const markers = verseMarkers(
      [source('study.md', false, 'John 15:2', 'John 15:8')],
      chapter,
    )

    expect(markers.get(verse(2))).toEqual({ annotations: 0, mentions: 1 })
    expect(markers.get(verse(8))).toEqual({ annotations: 0, mentions: 1 })
  })
})
