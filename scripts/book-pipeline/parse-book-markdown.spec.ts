import { describe, expect, it } from 'vitest'
import { parseBookMarkdown } from './parse-book-markdown'

const source = [
  '---',
  'module: in-at-e1',
  'language: English',
  '---',
  '',
  '## 0. Prologue {named}',
  '',
  'A few years ago I read a book.',
  'It resonated with me.',
  '',
  '### Introduction',
  '',
  'Why the title IN?',
  '',
  '# PART ONE: Fall of man – Death through sin',
  '',
  '## 1. Man as God Intended',
  '',
  "Let's start at the very beginning.",
  '',
  '#### 7.1 They knew that they were naked',
  '',
  '- Be free from comfort.',
  '- Be of no reputation.',
  '',
  '| God’s kingdom | 1:1',
  '| World | 2:1',
  '',
  '> Not I, but Christ.',
  '> — Galatians 2:20',
  '',
].join('\n')

describe('parseBookMarkdown', () => {
  const parsed = parseBookMarkdown(source)

  it('reads the module the source is curated for from its front matter', () => {
    expect(parsed.moduleId).toBe('in-at-e1')
    expect(parsed.language).toBe('English')
  })

  it('opens a section per section head, keeping its printed number and name', () => {
    expect(
      parsed.sections.map(({ chapter, name, named }) => ({
        chapter,
        name,
        named,
      })),
    ).toEqual([
      { chapter: 0, name: 'Prologue', named: true },
      { chapter: 1, name: 'Man as God Intended', named: undefined },
    ])
  })

  it('unwraps a prose block into one paragraph atom', () => {
    expect(parsed.sections[0].paragraphs[0].text).toBe(
      'A few years ago I read a book. It resonated with me.',
    )
  })

  it('keeps a list whole as a single atom, one item per line', () => {
    expect(parsed.sections[1].paragraphs[1].text).toBe(
      '- Be free from comfort.\n- Be of no reputation.',
    )
  })

  it('keeps a pre-flattened table whole as a single atom, one row per line', () => {
    expect(parsed.sections[1].paragraphs[2].text).toBe(
      'God’s kingdom | 1:1\nWorld | 2:1',
    )
  })

  it('says where every kept line starts, so the reader prints the breaks', () => {
    expect(parsed.sections[1].paragraphs[1].lines).toEqual([
      { start: 0 },
      { start: '- Be free from comfort.'.length + 1 },
    ])
    expect(parsed.sections[1].paragraphs[2].lines).toEqual([
      { start: 0 },
      { start: 'God’s kingdom | 1:1'.length + 1 },
    ])
  })

  it('leaves prose without a line channel', () => {
    expect(parsed.sections[0].paragraphs[0].lines).toBeUndefined()
  })

  it('attaches a lower-level heading to the paragraph it precedes', () => {
    expect(parsed.sections[0].paragraphs[1].headings).toEqual([
      { text: 'Introduction', level: 'section' },
    ])
    expect(parsed.sections[1].paragraphs[1].headings).toEqual([
      { text: '7.1 They knew that they were naked', level: 'sub-section' },
    ])
  })

  it('carries a part heading across the section head that follows it', () => {
    expect(parsed.sections[1].paragraphs[0].headings).toEqual([
      { text: 'PART ONE: Fall of man – Death through sin', level: 'part' },
    ])
  })

  it('leaves a paragraph no heading introduces without one', () => {
    expect(parsed.sections[0].paragraphs[0].headings).toBeUndefined()
  })

  it('parses a block quote as an epigraph beside the section prose', () => {
    expect(parsed.sections[1].epigraphs).toEqual([
      { quote: 'Not I, but Christ.', attribution: 'Galatians 2:20' },
    ])
  })

  it('refuses a source whose front matter names no module', () => {
    expect(() => parseBookMarkdown('## 1. A\n\ntext\n')).toThrow(
      /front matter/i,
    )
  })

  it('refuses prose that arrives before any section head', () => {
    expect(() =>
      parseBookMarkdown('---\nmodule: x\n---\n\nstray prose\n'),
    ).toThrow(/before the first section head/i)
  })

  it('refuses a section head without a chapter number', () => {
    expect(() =>
      parseBookMarkdown('---\nmodule: x\n---\n\n## Prologue\n\ntext\n'),
    ).toThrow(/section head/i)
  })
})
