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
  '| --- | ---',
  '| World | 2:1',
  '|  | 2:2',
  '',
  '> Not I, but Christ.',
  '> — Galatians 2:20',
  '',
  '![The tree of life](in-images/tree-of-life.png "Fig 2 Tree of Life")',
  '',
  'The tree of life is the Spirit of Jesus.',
  '',
  '![I am the vine](in-images/i-am-the-vine.png)',
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
      'God’s kingdom | 1:1\nWorld | 2:1\n2:2',
    )
  })

  it('marks every row’s cells, an empty one as a span of no width', () => {
    const table = parsed.sections[1].paragraphs[2]
    expect(
      table.lines?.map((line) =>
        (line.cells ?? []).map((cell) => table.text.slice(cell.start, cell.end)),
      ),
    ).toEqual([
      ['God’s kingdom', '1:1'],
      ['World', '2:1'],
      ['', '2:2'],
    ])
  })

  it('reads the row above a `---` rule as the table’s header row', () => {
    const table = parsed.sections[1].paragraphs[2]
    expect(table.lines?.map((line) => line.header)).toEqual([
      true,
      undefined,
      undefined,
    ])
  })

  it('leaves a list’s lines without cells — a list is no table', () => {
    const list = parsed.sections[1].paragraphs[1]
    expect(list.lines?.every((line) => line.cells === undefined)).toBe(true)
    expect(list.lines?.every((line) => line.header === undefined)).toBe(true)
  })

  it('says where every kept line starts, so the reader prints the breaks', () => {
    expect(parsed.sections[1].paragraphs[1].lines).toEqual([
      { start: 0 },
      { start: '- Be free from comfort.'.length + 1 },
    ])
    expect(parsed.sections[1].paragraphs[2].lines?.map((line) => line.start)).toEqual([
      0,
      'God’s kingdom | 1:1'.length + 1,
      'God’s kingdom | 1:1\nWorld | 2:1'.length + 1,
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

  it('attaches a figure to the paragraph it precedes, printed above it', () => {
    expect(parsed.sections[1].paragraphs[3].figures?.[0]).toEqual({
      path: 'in-images/tree-of-life.png',
      alt: 'The tree of life',
      caption: 'Fig 2 Tree of Life',
      place: 'above',
    })
  })

  it('attaches a figure that closes a section to its last paragraph, below', () => {
    const paragraphs = parsed.sections[1].paragraphs
    const figures = paragraphs[paragraphs.length - 1].figures ?? []
    expect(figures[figures.length - 1]).toEqual({
      path: 'in-images/i-am-the-vine.png',
      alt: 'I am the vine',
      place: 'below',
    })
  })

  it('leaves a paragraph no figure stands with without one', () => {
    expect(parsed.sections[0].paragraphs[0].figures).toBeUndefined()
  })

  it('refuses a figure with no paragraph to stand with', () => {
    expect(() =>
      parseBookMarkdown('---\nmodule: x\n---\n\n## 1. A\n\n![a](a.png)\n'),
    ).toThrow(/figure/i)
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

  it('refuses a paragraph Book’s section head without a name', () => {
    expect(() =>
      parseBookMarkdown('---\nmodule: x\n---\n\n## 5.\n\ntext\n'),
    ).toThrow(/section head/i)
  })

  it('refuses a section head without a chapter number', () => {
    expect(() =>
      parseBookMarkdown('---\nmodule: x\n---\n\n## Prologue\n\ntext\n'),
    ).toThrow(/section head/i)
  })
})

describe('parseBookMarkdown for a verse-atom Book', () => {
  const verseSource = [
    '---',
    'module: 1en-c1912',
    '---',
    '',
    '# The Book of the Watchers',
    '',
    '### I-V. Parable of Enoch',
    '',
    '## 1.',
    '',
    '1. The words of the blessing of Enoch, wherewith he blessed',
    'the elect. 2. And he took up his parable.',
    '2. Concerning the elect I said:',
    '',
    '3. The Holy Great One will come forth,',
    '3. And the eternal God will tread upon the earth.',
    '',
    '',
    '',
    '### A head inside the chapter',
    '',
    '4a. And all shall be smitten with fear,',
    '4b. And the Watchers shall quake.',
    '',
    '## 2. Titled',
    '',
    '1. Observe ye every thing.',
    '',
    '## 3. Prologue {named}',
    '',
    '1. Observe and see.',
    '',
  ].join('\n')
  const parsed = parseBookMarkdown(verseSource, { atom: 'verse' })

  it('names an untitled section by its printed chapter number, not `named`', () => {
    expect(parsed.sections.map(({ chapter, name, named }) => ({ chapter, name, named }))).toEqual([
      { chapter: 1, name: '1', named: undefined },
      { chapter: 2, name: 'Titled', named: undefined },
      { chapter: 3, name: 'Prologue', named: true },
    ])
  })

  it('stores one atom per printed verse, in verse order', () => {
    expect(parsed.sections[0].paragraphs.map((verse) => verse.text)).toEqual([
      'The words of the blessing of Enoch, wherewith he blessed the elect. 2. And he took up his parable.',
      'Concerning the elect I said:',
      'The Holy Great One will come forth, And the eternal God will tread upon the earth.',
      'And all shall be smitten with fear, And the Watchers shall quake.',
    ])
    expect(parsed.sections[0].paragraphs[3].lines).toEqual([
      { start: 0, paragraph: true, letter: 'a' },
      { start: 'And all shall be smitten with fear, '.length, letter: 'b' },
    ])
  })

  it('attaches the Part and section Headings to the verse they precede', () => {
    expect(parsed.sections[0].paragraphs[0].headings).toEqual([
      { text: 'The Book of the Watchers', level: 'part' },
      { text: 'I-V. Parable of Enoch', level: 'section' },
    ])
    expect(parsed.sections[0].paragraphs[3].headings).toEqual([
      { text: 'A head inside the chapter', level: 'section' },
    ])
    expect(parsed.sections[0].paragraphs[1].headings).toBeUndefined()
  })

  it('emits no reading for a section walked in the identity order', () => {
    expect(parsed.sections.every((section) => section.reading === undefined)).toBe(true)
  })

  it('emits the page walk as reading where a later verse’s line stands inside an earlier verse', () => {
    const interleaved = parseBookMarkdown(
      '---\nmodule: x\n---\n\n## 5.\n\n1a. One\n1b. Two\n2c. Seven\n\n1c. Three\n2a. Five\n2b. Six\n',
      { atom: 'verse' },
    )
    expect(interleaved.sections[0].reading).toEqual([
      { atom: 1, line: 0 },
      { atom: 1, line: 1 },
      { atom: 2, line: 2 },
      { atom: 1, line: 2 },
      { atom: 2, line: 0 },
      { atom: 2, line: 1 },
    ])
  })

  it('cites the source line of a failure, counting front matter and blank runs', () => {
    expect(() =>
      parseBookMarkdown(verseSource.replace('4b. And the Watchers', '4B. And the Watchers'), {
        atom: 'verse',
      }),
    ).toThrow(/^line 23: /)
  })

  it('reads `1.` as verse 1, never as a list, and refuses a list or table', () => {
    expect(parsed.sections[1].paragraphs[0]).toEqual({ text: 'Observe ye every thing.' })
    expect(() =>
      parseBookMarkdown('---\nmodule: x\n---\n\n## 1.\n\n1. Verse\n- item\n', { atom: 'verse' }),
    ).toThrow(/line 8: .*list or table/i)
    expect(() =>
      parseBookMarkdown('---\nmodule: x\n---\n\n## 1.\n\n1. Verse\n\n| a | b\n', { atom: 'verse' }),
    ).toThrow(/line 9: .*list or table/i)
  })

  it('leaves a paragraph Book’s `1.` list exactly as it was', () => {
    const list = parseBookMarkdown('---\nmodule: x\n---\n\n## 1. A\n\n1. one\n2. two\n')
    expect(list.sections[0].paragraphs[0].text).toBe('1. one\n2. two')
    expect(list.sections[0].reading).toBeUndefined()
  })
})

describe('parseBookMarkdown Editorial marks', () => {
  const book = (body: string, atom: 'verse' | 'paragraph' = 'paragraph') =>
    parseBookMarkdown(`---\nmodule: x\n---\n\n${body}`, { atom })

  it('strips a prose paragraph’s wrappers into channels over the stored string', () => {
    const [paragraph] = book(
      '## 1. A\n\nThe <supplied>Lord</supplied> is <marks>⌈</marks>my\n<emended>shepherd</emended><marks>⌉</marks>.\n',
    ).sections[0].paragraphs
    expect(paragraph).toEqual({
      text: 'The Lord is ⌈my shepherd⌉.',
      supplied: [{ start: 4, end: 8 }],
      marks: [
        { start: 12, end: 13 },
        { start: 24, end: 25 },
      ],
      emended: [{ start: 16, end: 24 }],
    })
  })

  it('keeps a list’s line starts and a table’s cells on their text through the strip', () => {
    const [list, table] = book(
      '## 1. A\n\n- <marks>⌈</marks>one\n- two<marks>⌉</marks>\n\n| <supplied>a</supplied> | b\n| c | <marks>†</marks>d<marks>†</marks>\n',
    ).sections[0].paragraphs
    expect(list).toEqual({
      text: '- ⌈one\n- two⌉',
      marks: [
        { start: 2, end: 3 },
        { start: 12, end: 13 },
      ],
      lines: [{ start: 0 }, { start: 7 }],
    })
    expect(table).toEqual({
      text: 'a | b\nc | †d†',
      supplied: [{ start: 0, end: 1 }],
      marks: [
        { start: 10, end: 11 },
        { start: 12, end: 13 },
      ],
      lines: [
        { start: 0, cells: [{ start: 0, end: 1 }, { start: 4, end: 5 }] },
        { start: 6, cells: [{ start: 6, end: 7 }, { start: 10, end: 13 }] },
      ],
    })
  })

  it('strips an epigraph’s wrappers into channels over its quote', () => {
    const [epigraph] = book(
      '## 1. A\n\n> Not <supplied>I</supplied>, but <marks>⌈</marks>Christ<marks>⌉</marks>.\n> — Galatians 2:20\n\nText.\n',
    ).sections[0].epigraphs ?? []
    expect(epigraph).toEqual({
      quote: 'Not I, but ⌈Christ⌉.',
      attribution: 'Galatians 2:20',
      supplied: [{ start: 4, end: 5 }],
      marks: [
        { start: 11, end: 12 },
        { start: 18, end: 19 },
      ],
    })
  })

  it.each([
    ['## 1. A\n\nOne.\n\nTwo <mark>x</mark>.\n', /atom 1\.2: <mark> is not one of/],
    ['## 1. A\n\nOne < two.\n', /atom 1\.1: a raw `<`/],
    ['## 1. A\n\n> A <marks>⌈quote\n> — Someone\n\nOne.\n', /atom 1\.e1: <marks> is never closed/],
    ['## 1. A\n\n> A quote\n> — Some<one\n\nOne.\n', /atom 1\.e1: a raw `<`/],
    ['## 1. A\n\n## 2. B\n\n> Fine\n\n> <marks></marks>\n\nOne.\n', /atom 2\.e2: empty <marks>/],
  ])('fails, citing the atom or epigraph, on %j', (body, message) => {
    expect(() => book(body)).toThrow(message)
  })

  it.each([
    ['# Part <marks>⌈</marks>One\n\n## 1. A\n\nOne.\n', /heading "Part <marks>⌈<\/marks>One": furniture never carries an Editorial mark/],
    ['## 1. A\n\n### 1.1 <supplied>Head</supplied>\n\nOne.\n', /heading "1\.1 <supplied>Head<\/supplied>"/],
    ['## 0. Pro<marks>l</marks>ogue {named}\n\nOne.\n', /section head "Pro<marks>l<\/marks>ogue": furniture/],
    ['## 1. A <emended>b</emended>\n\nOne.\n', /section head "A <emended>b<\/emended>"/],
    ['## 1. A\n\n![alt](x.png "Fig <marks>1</marks>")\n\nOne.\n', /figure caption "Fig <marks>1<\/marks>"/],
    ['## 1. A\n\n![a <supplied>tree</supplied>](x.png)\n\nOne.\n', /figure alt "a <supplied>tree<\/supplied>"/],
  ])('fails, citing the furniture, on %j', (body, message) => {
    expect(() => book(body)).toThrow(message)
  })

  it('fails, citing the furniture, in a verse-atom Book too', () => {
    expect(() => book('## 1.\n\n### The <marks>⌈</marks>Fall\n\n1. One.\n', 'verse')).toThrow(
      /heading "The <marks>⌈<\/marks>Fall"/,
    )
  })

  it('grows no channel on an unmarked Book', () => {
    const [paragraph] = book('## 1. A\n\nPlain text.\n').sections[0].paragraphs
    expect(paragraph).toEqual({ text: 'Plain text.' })
  })
})

describe('parseBookMarkdown Footnotes', () => {
  const book = (body: string, atom: 'verse' | 'paragraph' = 'paragraph') =>
    parseBookMarkdown(`---\nmodule: x\n---\n\n${body}`, { atom })

  it('lifts a paragraph’s notes out of its stored text', () => {
    const [paragraph] = book(
      '## 1. A\n\nWE have seen humility. [Footnote: I knew Jesus.] Once again I repeat.\n',
    ).sections[0].paragraphs
    expect(paragraph).toEqual({
      text: 'WE have seen humility. Once again I repeat.',
      footnotes: [{ start: 22, text: 'I knew Jesus.' }],
    })
  })

  it('anchors a list row’s note over the stored string, line starts unmoved', () => {
    const [list] = book(
      '## 1. A\n\n- <marks>⌈</marks>one [Footnote: Dillmann.]\n- two<marks>⌉</marks>\n',
    ).sections[0].paragraphs
    expect(list).toEqual({
      text: '- ⌈one\n- two⌉',
      marks: [
        { start: 2, end: 3 },
        { start: 12, end: 13 },
      ],
      footnotes: [{ start: 6, text: 'Dillmann.' }],
      lines: [{ start: 0 }, { start: 7 }],
    })
  })

  it('grows no channel on a Book that carries no note', () => {
    const [paragraph] = book('## 1. A\n\nPlain text.\n').sections[0].paragraphs
    expect(paragraph.footnotes).toBeUndefined()
  })

  it.each([
    ['## 1. A\n\nOne. [Footnote missing colon]\n', /atom 1\.1: a `\[Footnote` marker the build cannot read/],
    ['## 1. A\n\n> A quote [Footnote: a note]\n> — Someone\n\nOne.\n', /epigraph 1\.e1: only an atom carries a Footnote/],
  ])('fails, citing the atom or epigraph, on %j', (body, message) => {
    expect(() => book(body)).toThrow(message)
  })

  it.each([
    ['# Part One [Footnote: a note]\n\n## 1. A\n\nOne.\n', /heading "Part One \[Footnote: a note\]": only an atom carries a Footnote/],
    ['## 1. A [Footnote: a note]\n\nOne.\n', /section head "A \[Footnote: a note\]": only an atom/],
    ['## 1. A\n\n![alt](x.png "Fig [Footnote: a note]")\n\nOne.\n', /figure caption "Fig \[Footnote: a note\]": only an atom/],
  ])('fails, citing the furniture, on %j', (body, message) => {
    expect(() => book(body)).toThrow(message)
  })
})
