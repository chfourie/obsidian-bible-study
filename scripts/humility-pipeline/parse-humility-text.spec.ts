import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  applyTranscriptionFixes,
  parseHumilityText,
  stripGutenbergWrapper,
} from './parse-humility-text'

const SOURCE = readFileSync('tests/fixtures/humility-slice.txt', 'utf8')

describe('stripGutenbergWrapper', () => {
  const stripped = stripGutenbergWrapper(SOURCE)

  it('keeps only the text between the start and end markers', () => {
    expect(stripped).toContain('PREFACE.')
    expect(stripped).toContain('A PRAYER FOR HUMILITY')
    expect(stripped).not.toContain('Updated editions will replace')
    expect(stripped).not.toContain('Title: Humility')
  })

  it('removes every trace of the Project Gutenberg name and its credit', () => {
    expect(stripped.toLowerCase()).not.toContain('gutenberg')
    expect(stripped).not.toContain('Free elf')
  })

  it('fails when the start marker is missing', () => {
    expect(() => stripGutenbergWrapper('no markers here')).toThrow(
      /start marker/i,
    )
  })

  it('fails when the end marker is missing', () => {
    const truncated = SOURCE.slice(0, SOURCE.indexOf('*** END'))
    expect(() => stripGutenbergWrapper(truncated)).toThrow(/end marker/i)
  })
})

describe('applyTranscriptionFixes', () => {
  const blemished =
    "and with him the is of a contrite and humble spirit.'" +
    ' to make it known the region of eternity (John v 30)'

  it('restores the dropped words in the Isaiah lvii. 15 quotation', () => {
    expect(applyTranscriptionFixes(blemished)).toContain(
      "and with him also that is of a contrite and humble spirit.'",
    )
  })

  it('restores the dropped preposition in Note A', () => {
    expect(applyTranscriptionFixes(blemished)).toContain(
      'to make it known in the region of eternity',
    )
  })

  it('restores the missing period in the John v. 30 citation', () => {
    expect(applyTranscriptionFixes(blemished)).toContain('(John v. 30)')
  })

  it('fails when a fix no longer matches its source text exactly once', () => {
    expect(() => applyTranscriptionFixes('unblemished text')).toThrow(
      /transcription fix/i,
    )
  })
})

describe('parseHumilityText', () => {
  const sections = parseHumilityText(SOURCE)
  const sectionAt = (chapter: number) =>
    sections.find((section) => section.chapter === chapter)!

  it('numbers sections in reading order keeping printed chapter numbers', () => {
    expect(sections.map((section) => [section.chapter, section.name])).toEqual([
      [0, 'Preface'],
      [1, 'Humility: The Glory of the Creature'],
      [2, 'Humility in the Teaching of Jesus'],
      [13, 'Note A'],
      [14, 'Note B'],
      [15, 'A Prayer for Humility'],
    ])
  })

  it('drops front matter, the table of contents, and running heads', () => {
    const allText = sections
      .flatMap((section) => section.paragraphs.map((it) => it.text))
      .join('\n')
    expect(allText).not.toContain('FLEMING H. REVELL')
    expect(allText).not.toContain('The Beauty of Holiness')
    expect(allText).not.toContain("''")
  })

  it('joins wrapped lines into one paragraph each', () => {
    expect(sectionAt(0).paragraphs).toHaveLength(2)
    expect(sectionAt(0).paragraphs[0].text).toBe(
      'There are three great motives that urge us to humility. It becomes' +
        ' me as a creature, as a sinner, as a saint.',
    )
  })

  it('takes epigraphs as chapter metadata rather than paragraphs', () => {
    expect(sectionAt(1).epigraphs).toEqual([
      {
        quote:
          'They shall cast their crowns before the throne, saying: Worthy' +
          ' art Thou, our Lord and our God.',
        attribution: 'REV. iv. 11.',
      },
    ])
    expect(sectionAt(1).paragraphs).toHaveLength(2)
  })

  it('reads several epigraphs on one chapter', () => {
    expect(sectionAt(2).epigraphs).toEqual([
      {
        quote: 'Learn of Me, for I am meek and lowly of heart.',
        attribution: 'MATT. xi. 29.',
      },
      {
        quote: 'Whosoever will be chief among you, let him be your servant.',
        attribution: 'MATT. xx. 27.',
      },
    ])
  })

  it('leaves chapters without an epigraph free of the field', () => {
    expect(sectionAt(0).epigraphs).toBeUndefined()
  })

  it('keeps quoted prose that opens a body paragraph as a paragraph', () => {
    expect(sectionAt(1).paragraphs[1].text).toBe(
      'And so pride, or the loss of this humility, is the root of every' +
        " sin. 'I seek not Mine own will' (John v. 30). (See Note A.)",
    )
  })

  it('lifts footnotes out of their anchor paragraph, keeping the anchor', () => {
    const [first, second] = sectionAt(2).paragraphs
    expect(first.text).toBe(
      'WE have seen humility in the life of Christ, as He laid open His' +
        ' heart to us.',
    )
    expect(first.footnotes).toEqual([
      {
        start: first.text.length,
        text: "I knew Jesus, and He was very precious.'--GEORGE FOXE.",
      },
    ])
    expect(second.text).toBe(
      'Once again I repeat what I have said before. In their spiritual' +
        ' history men may have had times of great humbling.',
    )
    expect(second.footnotes).toEqual([
      {
        start: 'Once again I repeat what I have said before.'.length,
        text: 'ME is a most exacting personage.',
      },
    ])
  })

  it('leaves paragraphs without footnotes free of the channel', () => {
    expect(sectionAt(0).paragraphs[0].footnotes).toBeUndefined()
  })

  it('applies the transcription fixes to stored paragraph text', () => {
    expect(sectionAt(2).paragraphs[2].text).toContain(
      "and with him also that is of a contrite and humble spirit.'",
    )
    expect(sectionAt(13).paragraphs[0].text).toContain(
      'to make it known in the region of eternity',
    )
  })

  it('starts a note section at its heading, keeping the heading prose', () => {
    expect(sectionAt(13).paragraphs).toHaveLength(1)
    expect(sectionAt(13).paragraphs[0].text).toBe(
      "'All this is to make it known in the region of eternity that pride" +
        " can degrade the highest angels into devils.'--Spirit of Prayer," +
        ' Pt. II. p. 73.',
    )
  })

  it('drops italic markers from stored text', () => {
    const allText = sections
      .flatMap((section) => section.paragraphs.map((it) => it.text))
      .join('\n')
    expect(allText).not.toContain('_')
  })

  it('numbers the closing prayer after the last note', () => {
    expect(sectionAt(15).paragraphs[0].text).toBe(
      'I will here give you an infallible touchstone, that will try all to' +
        ' the truth.',
    )
  })
})
