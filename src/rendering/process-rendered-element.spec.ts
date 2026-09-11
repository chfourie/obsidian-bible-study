import { describe, expect, it, vi } from 'vitest'
import type { Passage } from './module-passage-source'
import {
  processRenderedElement,
  wholeNoteSection,
  type RenderedSection,
} from './process-rendered-element'
import type { ReferenceRenderDeps } from './render-reference'
import type { RenderContext } from './reference-render-model'

const context: RenderContext = {
  knownTranslationIds: ['web'],
  defaultTranslationId: 'web',
  pageBreaks: true,
}

const passage: Passage = {
  status: 'ok',
  attribution: null,
  verses: [{ verseId: 43015004, segments: [{ text: 'Remain.', redLetter: false }] }],
}

const setup = () => {
  const deps: ReferenceRenderDeps = {
    passages: { passage: async () => passage },
    openReference: vi.fn(),
  }
  const root = document.createElement('div')
  return { root, deps }
}

const wholeNote = (source: string): RenderedSection => ({
  noteSource: source,
  lineStart: 0,
  lineEnd: source.split('\n').length - 1,
})

const process = (
  root: HTMLElement,
  deps: ReferenceRenderDeps,
  sectionSource = '',
  sourcePath: string | null = null,
  renderContext: RenderContext = context,
) =>
  processRenderedElement(
    root,
    renderContext,
    deps,
    wholeNote(sectionSource),
    sourcePath,
  )

const chipLabels = (root: HTMLElement): string[] =>
  [...root.querySelectorAll('.scripture-study-chip-ref')].map(
    (ref) => ref.textContent ?? '',
  )

describe('processRenderedElement', () => {
  it('passes the note path so its own occurrences stay off the surface', async () => {
    const { root, deps } = setup()
    deps.intersections = {
      intersecting: () => [
        {
          file: 'Sermons/Abiding.md',
          annotationReference: null,
          crossReference: null,
          occurrences: [],
        },
        {
          file: 'Topics/Union.md',
          annotationReference: null,
          crossReference: null,
          occurrences: [],
        },
      ],
      openNote: vi.fn(),
    }
    root.innerHTML = '<p>{John 15:4}</p>'

    await process(root, deps, '', 'Sermons/Abiding.md')

    const toggle = root.querySelector('.scripture-study-intersections-toggle')
    expect(toggle?.textContent).toBe('◆1')
  })

  it('replaces a brace reference with a chip, keeping surrounding text', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>Abide: {John 15:4} in him.</p>'

    await process(root, deps)

    const paragraph = root.querySelector('p')
    expect(paragraph?.querySelector('.scripture-study-chip')).not.toBeNull()
    expect(paragraph?.textContent).toContain('Abide: ')
    expect(paragraph?.textContent).toContain(' in him.')
    expect(paragraph?.textContent).not.toContain('{')
  })

  it('renders every reference in a text node', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{John 15:4} and {Jhn 15:9}</p>'

    await process(root, deps)

    expect(root.querySelectorAll('.scripture-study-chip')).toHaveLength(2)
  })

  it('leaves invalid brace content untouched', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{"json": true} and {Nowhere 3:16}</p>'

    await process(root, deps)

    expect(root.querySelector('.scripture-study-chip')).toBeNull()
    expect(root.textContent).toBe('{"json": true} and {Nowhere 3:16}')
  })

  it('never renders inside code or pre elements', async () => {
    const { root, deps } = setup()
    root.innerHTML =
      '<p>use <code>{John 15:4}</code></p><pre><code>{John 15:9}</code></pre>'

    await process(root, deps)

    expect(root.querySelector('.scripture-study-chip')).toBeNull()
  })

  it('strips a visible escape backslash and leaves literal text', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>\\{John 15:4}</p>'

    await process(root, deps)

    expect(root.querySelector('.scripture-study-chip')).toBeNull()
    expect(root.textContent).toBe('{John 15:4}')
  })

  it('escapes exactly the occurrence the source escaped, later position', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{John 15:4} then {John 15:4}</p>'

    await process(root, deps, '{John 15:4} then \\{John 15:4}')

    expect(root.querySelectorAll('.scripture-study-chip')).toHaveLength(1)
    expect(root.querySelector('p')?.textContent).toBe(
      'John 15:4 then {John 15:4}',
    )
  })

  it('escapes exactly the occurrence the source escaped, earlier position', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{John 15:4} then {John 15:4}</p>'

    await process(root, deps, '\\{John 15:4} then {John 15:4}')

    expect(root.querySelectorAll('.scripture-study-chip')).toHaveLength(1)
    expect(root.querySelector('p')?.textContent).toBe(
      '{John 15:4} then John 15:4',
    )
  })

  it('suppresses every occurrence when the source escapes them all', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{John 15:4} then {John 15:4}</p>'

    await process(root, deps, '\\{John 15:4} then \\{John 15:4}')

    expect(root.querySelector('.scripture-study-chip')).toBeNull()
    expect(root.querySelector('p')?.textContent).toBe(
      '{John 15:4} then {John 15:4}',
    )
  })

  it('ignores code-span candidates when matching source escapes', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p><code>{John 15:4}</code> then {John 15:4}</p>'

    await process(root, deps, '`{John 15:4}` then \\{John 15:4}')

    expect(root.querySelector('.scripture-study-chip')).toBeNull()
  })

  it('renders an Annotation body’s excerpt as the note shows it', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{John 15:4 inline x/4.0-6}</p>'

    await process(root, deps)

    expect(root.querySelector('.scripture-study-passage')?.textContent).toBe(
      'Remain…',
    )
    expect(
      root.querySelector('.scripture-study-passage-ellipsis')?.closest('[data-verse-id]'),
    ).toBeNull()
  })

  it('renders inline passages beside the chip', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>He said {John 15:4 inline} to them.</p>'

    await process(root, deps)

    expect(root.querySelector('.scripture-study-passage')?.textContent).toBe(
      'Remain.',
    )
  })

  it('resolves a relative reference against an anchor in the same section', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{John 15:4-9} says {:5} here.</p>'

    await process(root, deps, '{John 15:4-9} says {:5} here.')

    expect(chipLabels(root)).toEqual(['John 15:4-9', '[:5]'])
    expect(
      root.querySelectorAll<HTMLElement>('.scripture-study-chip')[1].title,
    ).toBe('John 15:5')
  })

  it('resolves an anchor from an earlier section of the whole note', async () => {
    const { root, deps } = setup()
    const noteSource =
      '---\nref: John 3:16\n---\n# Abiding\n{John 15:4-9}\n\n## Fruit\n{:5} bears fruit.\n'
    root.innerHTML = '<p>{:5} bears fruit.</p>'

    await processRenderedElement(
      root,
      context,
      deps,
      { noteSource, lineStart: 7, lineEnd: 7 },
      null,
    )

    expect(chipLabels(root)).toEqual(['[:5]'])
  })

  it('leaves a relative reference plain without a preceding anchor', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{:5} then {John 15:4-9}</p>'

    await process(root, deps, '{:5} then {John 15:4-9}')

    expect(chipLabels(root)).toEqual(['John 15:4-9'])
    expect(root.textContent).toContain('{:5}')
  })

  it('leaves a relative reference plain when no source is supplied', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{John 15:4-9} says {:5} here.</p>'

    await process(root, deps)

    expect(chipLabels(root)).toEqual(['John 15:4-9'])
  })

  it('renders a relative block passage with its cue, editable when a writer is supplied', async () => {
    const { root, deps } = setup()
    const editHighlights = vi.fn()
    const source = '{John 15:4-9 web} says {:4 block h1/4.0-6} here.'
    root.innerHTML =
      '<p>{John 15:4-9 web} says {:4 block h1/4.0-6} here.</p>'

    await processRenderedElement(
      root,
      context,
      { ...deps, editHighlights },
      wholeNote(source),
      null,
    )

    expect(chipLabels(root)).toEqual(['John 15:4-9', '[:4]'])
    expect(root.querySelector('.scripture-study-block')).not.toBeNull()
    expect(
      root.querySelector('.scripture-study-highlight-1')?.textContent,
    ).toBe('Remain')
    expect(editHighlights).toHaveBeenCalled()
  })

  it('keeps an escaped relative reference literal', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{John 15:4-9} {:5} {:5}</p>'

    await process(root, deps, '{John 15:4-9} \\{:5} {:5}')

    expect(chipLabels(root)).toEqual(['John 15:4-9', '[:5]'])
    expect(root.textContent).toContain('{:5}')
  })

  describe('Christ Quote', () => {
    const redLetterTexts = (root: HTMLElement): string[] =>
      [...root.querySelectorAll('.scripture-study-red-letter')].map(
        (span) => span.textContent ?? '',
      )

    it('drops the c and wraps the quote, marks included, in the red-letter class', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>He said c"Abide in me" to them.</p>'

      await process(root, deps, 'He said c"Abide in me" to them.')

      expect(redLetterTexts(root)).toEqual(['"Abide in me"'])
      expect(root.querySelector('p')?.textContent).toBe(
        'He said "Abide in me" to them.',
      )
    })

    it('accepts curly marks', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>c“Abide in me”</p>'

      await process(root, deps, 'c“Abide in me”')

      expect(redLetterTexts(root)).toEqual(['“Abide in me”'])
      expect(root.textContent).toBe('“Abide in me”')
    })

    it('requires the closing mark to match the opening kind', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>c"Abide” here</p><p>c“more" here</p>'

      await process(root, deps, 'c"Abide” here\n\nc“more" here')

      expect(redLetterTexts(root)).toEqual([])
      expect(root.textContent).toBe('c"Abide” herec“more" here')
    })

    it('requires the c to start a word', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>Isaac"laughed" and C"no" but (c"yes")</p>'

      await process(root, deps, 'Isaac"laughed" and C"no" but (c"yes")')

      expect(redLetterTexts(root)).toEqual(['"yes"'])
      expect(root.textContent).toBe('Isaac"laughed" and C"no" but ("yes")')
    })

    it('trusts the source over a c the rendered text alone puts at a word start', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>Isa<mark>a</mark>c"laughed"</p>'

      await process(root, deps, 'Isa==a==c"laughed"')

      expect(redLetterTexts(root)).toEqual([])
      expect(root.textContent).toBe('Isaac"laughed"')
    })

    it('leaves an unterminated quote unchanged', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>c"Abide in me</p>'

      await process(root, deps, 'c"Abide in me')

      expect(redLetterTexts(root)).toEqual([])
      expect(root.textContent).toBe('c"Abide in me')
    })

    it('leaves a quote closing in a later paragraph unchanged', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>c"Abide in me</p><p>and I in you"</p>'

      await process(root, deps, 'c"Abide in me\n\nand I in you"')

      expect(redLetterTexts(root)).toEqual([])
      expect(root.textContent).toBe('c"Abide in meand I in you"')
    })

    it('lets a heading end the paragraph a quote opened in', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>c"Abide</p><h1>heading c"x" more"</h1>'

      await process(root, deps, 'c"Abide\n# heading c"x" more"')

      expect(redLetterTexts(root)).toEqual(['"x"'])
      expect(root.textContent).toBe('c"Abideheading "x" more"')
    })

    it('never decorates inside code or pre elements', async () => {
      const { root, deps } = setup()
      root.innerHTML =
        '<p>use <code>c"Abide"</code></p><pre><code>c"Abide"</code></pre>'

      await process(root, deps, 'use `c"Abide"`\n\n```\nc"Abide"\n```')

      expect(redLetterTexts(root)).toEqual([])
    })

    it('lets a mark inside inline code neither end nor escape the quote', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>c"Abide <code>"</code> in me" and c"more"</p>'

      await process(root, deps, 'c"Abide `"` in me" and c"more"')

      expect(redLetterTexts(root)).toEqual(['"Abide " in me"', '"more"'])
      expect(root.querySelectorAll('.scripture-study-red-letter code')).toHaveLength(1)
      expect(root.textContent).toBe('"Abide " in me" and "more"')
    })

    it('spans bold, italic, links and inline code inside the quote in one red range', async () => {
      const { root, deps } = setup()
      root.innerHTML =
        '<p>He said c"<strong>Abide</strong> in <em>me</em>, see <a href="x">here</a> and <code>x</code>" then left.</p>'

      await process(
        root,
        deps,
        'He said c"**Abide** in *me*, see [here](x) and `x`" then left.',
      )

      const span = root.querySelector('.scripture-study-red-letter')
      expect(span?.textContent).toBe('"Abide in me, see here and x"')
      expect(
        [...(span?.children ?? [])].map((child) => child.tagName),
      ).toEqual(['STRONG', 'EM', 'A', 'CODE'])
      expect(root.querySelector('p')?.textContent).toBe(
        'He said "Abide in me, see here and x" then left.',
      )
    })

    it('spans a soft line break inside the quote', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>c"Abide<br>in me" now</p>'

      await process(root, deps, 'c"Abide\nin me" now')

      const span = root.querySelector('.scripture-study-red-letter')
      expect(span?.innerHTML).toBe('"Abide<br>in me"')
      expect(root.querySelector('p')?.textContent).toBe('"Abidein me" now')
    })

    it('ends the quote at a closing mark nested inside an inline element', async () => {
      const { root, deps } = setup()
      root.innerHTML =
        '<p>c"Abide <strong>in me"</strong> and c"I <em>in you" more</em> text</p>'

      await process(
        root,
        deps,
        'c"Abide **in me"** and c"I *in you" more* text',
      )

      expect(redLetterTexts(root)).toEqual(['"Abide in me"', '"I in you"'])
      expect(root.querySelector('p')?.innerHTML).toBe(
        '<span class="scripture-study-red-letter">"Abide <strong>in me"</strong></span> and ' +
          '<span class="scripture-study-red-letter">"I <em>in you"</em></span><em> more</em> text',
      )
    })

    it('starts the quote from an opening mark nested inside an inline element', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p><em>He said c"Abide</em> in me" now</p>'

      await process(root, deps, '*He said c"Abide* in me" now')

      expect(root.querySelector('p')?.innerHTML).toBe(
        '<em>He said </em><span class="scripture-study-red-letter"><em>"Abide</em> in me"</span> now',
      )
    })

    it('leaves no empty shell when the quote fills an inline element edge', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p><em>c"Abide</em> in me" and c"I <strong>in you"</strong></p>'

      await process(root, deps, '*c"Abide* in me" and c"I **in you"**')

      expect(root.querySelector('p')?.innerHTML).toBe(
        '<span class="scripture-study-red-letter"><em>"Abide</em> in me"</span> and ' +
          '<span class="scripture-study-red-letter">"I <strong>in you"</strong></span>',
      )
    })

    it('keeps the close search inside the opening paragraph when no source is supplied', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>c"Abide in me</p><p>and I in you"</p>'

      await process(root, deps)

      expect(redLetterTexts(root)).toEqual([])
      expect(root.textContent).toBe('c"Abide in meand I in you"')
    })

    it('never reaches into a nested list item for the close when no source is supplied', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<ul><li>c"Abide<ul><li>in me"</li></ul></li></ul>'

      await process(root, deps)

      expect(redLetterTexts(root)).toEqual([])
      expect(root.innerHTML).toBe('<ul><li>c"Abide<ul><li>in me"</li></ul></li></ul>')
    })

    // A quote the source wrongly lets span a paragraph edge swallows the
    // next opening, so a second quote past the edge shows which model the
    // source applied even where the DOM bounds the close on its own.
    it('lets a nested list item start a new paragraph', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<ul><li>c"Abide<ul><li>in me c"x" more"</li></ul></li></ul>'

      await process(root, deps, '- c"Abide\n  - in me c"x" more"')

      expect(redLetterTexts(root)).toEqual(['"x"'])
    })

    it('lets a list item start a new paragraph but a continuation line stay in it', async () => {
      const { root, deps } = setup()
      root.innerHTML =
        '<ul><li>c"Abide</li><li>in me c"x" more"</li></ul>' +
        '<ol><li>c"I</li><li>in you c"y" more"</li></ol>' +
        '<ul><li>c"He<br>said"</li></ul>' +
        '<p>c"Then</p><ul><li>he left c"z" more"</li></ul>'

      await process(
        root,
        deps,
        '- c"Abide\n- in me c"x" more"\n\n1. c"I\n2) in you c"y" more"\n\n* c"He\n  said"\n\nc"Then\n+ he left c"z" more"',
      )

      expect(redLetterTexts(root)).toEqual(['"x"', '"y"', '"Hesaid"', '"z"'])
    })

    it('keeps a quote inside one table cell and lets a cell edge or row end it', async () => {
      const { root, deps } = setup()
      root.innerHTML =
        '<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody>' +
        '<tr><td>c"Abide</td><td>in me c"x" more"</td></tr>' +
        '<tr><td>c"I in you"</td><td>x</td></tr>' +
        '<tr><td>c"He</td><td>y</td></tr>' +
        '<tr><td>said c"w" more"</td><td>z</td></tr>' +
        '</tbody></table>'

      await process(
        root,
        deps,
        '| a | b |\n| - | - |\n| c"Abide | in me c"x" more" |\n| c"I in you" | x |\n| c"He | y |\n| said c"w" more" | z |',
      )

      expect(redLetterTexts(root)).toEqual(['"x"', '"I in you"', '"w"'])
    })

    it('keeps a blockquote continuing over its lines as one paragraph', async () => {
      const { root, deps } = setup()
      root.innerHTML =
        '<blockquote><p>c"Abide<br>in me"</p></blockquote>' +
        '<p>c"Then</p><blockquote><p>he left c"z" more"</p></blockquote>'

      await process(root, deps, '> c"Abide\n> in me"\n\nc"Then\n> he left c"z" more"')

      expect(redLetterTexts(root)).toEqual(['"Abidein me"', '"z"'])
    })

    it('renders a reference chip inside the quote as its usual chip within the red range', async () => {
      const { root, deps } = setup()
      root.innerHTML =
        '<p>c"<strong>Abide</strong> in me, {John 15:4} and I in you" then {John 15:5}</p>'

      await process(
        root,
        deps,
        'c"**Abide** in me, {John 15:4} and I in you" then {John 15:5}',
      )

      const span = root.querySelector('.scripture-study-red-letter')
      expect(span?.textContent).toBe('"Abide in me, John 15:4 and I in you"')
      expect(chipLabels(span as HTMLElement)).toEqual(['John 15:4'])
      expect(chipLabels(root)).toEqual(['John 15:4', 'John 15:5'])
    })

    it('matches an escaped reference inside the quote to its source occurrence', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>c"see {John 15:4}" and {John 15:4}</p>'

      await process(root, deps, 'c"see \\{John 15:4}" and {John 15:4}')

      expect(chipLabels(root)).toEqual(['John 15:4'])
      expect(root.querySelector('.scripture-study-red-letter')?.textContent).toBe(
        '"see {John 15:4}"',
      )
    })

    it('renders a frontmatter c-quote as plain text only in the body', async () => {
      const { root, deps } = setup()
      const noteSource = '---\ntitle: c"Abide"\n---\nc"Abide"\n'
      root.innerHTML = '<p>c"Abide"</p>'

      await processRenderedElement(
        root,
        context,
        deps,
        { noteSource, lineStart: 3, lineEnd: 3 },
        null,
      )

      expect(redLetterTexts(root)).toEqual(['"Abide"'])
    })

    it('keeps a source-escaped quote literal, with the c and no backslash', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>c"Abide in me"</p>'

      await process(root, deps, 'c\\"Abide in me"')

      expect(redLetterTexts(root)).toEqual([])
      expect(root.textContent).toBe('c"Abide in me"')
    })

    it('strips the backslash markdown leaves before a curly mark', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>c\\“Abide in me”</p>'

      await process(root, deps, 'c\\“Abide in me”')

      expect(redLetterTexts(root)).toEqual([])
      expect(root.textContent).toBe('c“Abide in me”')
    })

    it('escapes exactly the occurrence the source escaped', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>c"Abide" then c"Abide"</p>'

      await process(root, deps, 'c\\"Abide" then c"Abide"')

      expect(redLetterTexts(root)).toEqual(['"Abide"'])
      expect(root.textContent).toBe('c"Abide" then "Abide"')
    })

    it('renders two quotes in one paragraph independently', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>c"Abide in me" and c“I in you”, he said.</p>'

      await process(root, deps, 'c"Abide in me" and c“I in you”, he said.')

      expect(redLetterTexts(root)).toEqual(['"Abide in me"', '“I in you”'])
      expect(root.textContent).toBe('"Abide in me" and “I in you”, he said.')
    })

    it('lets a closing mark bound the next quote', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>c"Abide"c"in me"</p>'

      await process(root, deps, 'c"Abide"c"in me"')

      expect(redLetterTexts(root)).toEqual(['"Abide"', '"in me"'])
      expect(root.textContent).toBe('"Abide""in me"')
    })

    it('decorates from the rendered text alone when no source is supplied', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>c"Abide in me"</p>'

      await process(root, deps)

      expect(redLetterTexts(root)).toEqual(['"Abide in me"'])
    })

    it('keeps a reference chip beside a quote', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>c"Abide in me" {John 15:4}</p>'

      await process(root, deps, 'c"Abide in me" {John 15:4}')

      expect(redLetterTexts(root)).toEqual(['"Abide in me"'])
      expect(chipLabels(root)).toEqual(['John 15:4'])
    })
  })

  describe('Page Break', () => {
    const pageBreaks = (root: HTMLElement): HTMLElement[] => [
      ...root.querySelectorAll<HTMLElement>('.scripture-study-page-break'),
    ]

    it('turns a paragraph holding only the marker into one block element with icon and label', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>===</p>'

      await process(root, deps, 'Before.\n\n===\n\nAfter.')

      const [element] = pageBreaks(root)
      expect(pageBreaks(root)).toHaveLength(1)
      expect(element.tagName).toBe('DIV')
      expect(element.parentElement).toBe(root)
      expect(root.querySelector('p')).toBeNull()
      expect(
        element.querySelector('[data-icon="separator-horizontal"]'),
      ).not.toBeNull()
      expect(element.textContent).toBe('page break')
      expect(element.classList.contains('scripture-study-page-break-trailing')).toBe(false)
    })

    it('finds the paragraph through wrapper divs, as a whole-note export renders it', async () => {
      const { root, deps } = setup()
      root.innerHTML =
        '<div><div class="el-p"><p>Before.</p></div>' +
        '<div class="el-p"><p>===</p></div>' +
        '<div class="el-p"><p>After.</p></div></div>'

      await processRenderedElement(
        root,
        context,
        deps,
        wholeNoteSection('Before.\n\n===\n\nAfter.\n'),
      )

      expect(pageBreaks(root)).toHaveLength(1)
      expect(root.querySelectorAll('p')).toHaveLength(2)
    })

    it('tolerates spaces around the marker', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>  ===  </p>'

      await process(root, deps, 'Before.\n\n  ===  \n\nAfter.')

      expect(pageBreaks(root)).toHaveLength(1)
    })

    it('marks the Page Break trailing when no non-blank line follows it', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>===</p>'

      await process(root, deps, 'Before.\n\n===\n\n  \n')

      const [element] = pageBreaks(root)
      expect(element.classList.contains('scripture-study-page-break-trailing')).toBe(true)
    })

    it('does not mark it trailing when a fenced block follows', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>===</p>'

      await process(root, deps, '===\n\n```\ncode\n```\n')

      const [element] = pageBreaks(root)
      expect(element.classList.contains('scripture-study-page-break-trailing')).toBe(false)
    })

    it('breaks at the note edges', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>===</p>'

      await process(root, deps, '===')

      expect(pageBreaks(root)).toHaveLength(1)
    })

    it('renders each of two consecutive Page Breaks', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>===</p><p>===</p><p>After.</p>'

      await process(root, deps, '===\n\n===\n\nAfter.')

      expect(pageBreaks(root)).toHaveLength(2)
      expect(root.querySelectorAll('p')).toHaveLength(1)
    })

    it('leaves the marker alone inside code, list items, tables, blockquotes and callouts', async () => {
      const { root, deps } = setup()
      root.innerHTML =
        '<pre><code>===</code></pre>' +
        '<p><code>===</code></p>' +
        '<ul><li>===</li></ul>' +
        '<table><tbody><tr><td>===</td></tr></tbody></table>' +
        '<blockquote><p>===</p></blockquote>' +
        '<div class="callout"><div class="callout-content"><p>===</p></div></div>'

      await process(
        root,
        deps,
        '```\n===\n```\n\n`===`\n\n- ===\n\n| a |\n|---|\n| === |\n\n> ===\n\n> [!note]\n> ===\n',
      )

      expect(pageBreaks(root)).toEqual([])
      expect(root.querySelectorAll('p')).toHaveLength(3)
    })

    it('leaves a paragraph that merely begins with the marker alone', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>=== more</p>'

      await process(root, deps, '=== more')

      expect(pageBreaks(root)).toEqual([])
      expect(root.textContent).toBe('=== more')
    })

    it('leaves a setext heading as the heading Obsidian rendered', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<h1>Title</h1>'

      await process(root, deps, 'Title\n===')

      expect(pageBreaks(root)).toEqual([])
      expect(root.innerHTML).toBe('<h1>Title</h1>')
    })

    it('needs a blank line or note edge on both sides in the source', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>===</p>'

      await process(root, deps, '```\ncode\n```\n===\n\nAfter.')

      expect(pageBreaks(root)).toEqual([])
      expect(root.innerHTML).toBe('<p>===</p>')
    })

    it('breaks before text that follows the marker on the next line', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>===<br>After.</p>'

      await process(root, deps, 'Before.\n\n===\nAfter.\n')

      expect(pageBreaks(root)).toHaveLength(1)
      expect(root.innerHTML).toMatch(
        /^<div class="scripture-study-page-break">.*<\/div><p>After\.<\/p>$/,
      )
    })

    it('breaks before text that follows the marker under strict line breaks', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>===\nAfter.</p>'

      await process(root, deps, 'Before.\n\n===\nAfter.\n')

      expect(pageBreaks(root)).toHaveLength(1)
      expect(root.querySelector('p')?.textContent).toBe('After.')
    })

    it('leaves a marker that underlines a marker as the heading it is', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<h1>===</h1><p>===</p>'

      await process(root, deps, '===\n===\n\n===\n')

      expect(pageBreaks(root)).toHaveLength(1)
      expect(root.querySelector('h1')?.textContent).toBe('===')
      expect(pageBreaks(root)[0].classList.contains('scripture-study-page-break-trailing')).toBe(true)
    })

    it('never breaks inside frontmatter', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>===</p>'

      await process(root, deps, '---\ntitle: x\n===\n---\n')

      expect(pageBreaks(root)).toEqual([])
    })

    it('does nothing when the source is not supplied', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>===</p>'

      await process(root, deps)

      expect(root.innerHTML).toBe('<p>===</p>')
    })

    it('does nothing with page breaks off', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>===</p>'

      await process(root, deps, '===', null, { ...context, pageBreaks: false })

      expect(root.innerHTML).toBe('<p>===</p>')
    })

    it('breaks right after the frontmatter, the note edge there', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>===</p><p>After.</p>'

      await process(root, deps, '---\nk: v\n---\n===\n\nAfter.')

      const [element] = pageBreaks(root)
      expect(pageBreaks(root)).toHaveLength(1)
      expect(element.classList.contains('scripture-study-page-break-trailing')).toBe(false)
    })

    it('keeps an escaped marker from taking the Page Break that follows it', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>===</p><p>===</p>'

      await process(root, deps, '\\===\n\n===\n')

      expect(root.children).toHaveLength(2)
      expect(root.children[0].outerHTML).toBe('<p>===</p>')
      expect(root.children[1].classList.contains('scripture-study-page-break')).toBe(true)
      expect(root.children[1].classList.contains('scripture-study-page-break-trailing')).toBe(true)
    })

    it('keeps a marker right under a fence close from taking the Page Break that follows it', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<pre><code>code</code></pre><p>===</p><p>===</p><p>After.</p>'

      await process(root, deps, '```\ncode\n```\n===\n\n===\n\nAfter.')

      expect(root.children[1].outerHTML).toBe('<p>===</p>')
      expect(root.children[2].classList.contains('scripture-study-page-break')).toBe(true)
      expect(root.children[2].classList.contains('scripture-study-page-break-trailing')).toBe(false)
    })

    it('keeps an indented code block from taking the Page Break that follows it', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<pre><code>===\n</code></pre><p>===</p>'

      await process(root, deps, '    ===\n\n===\n')

      expect(root.children[0].outerHTML).toBe('<pre><code>===\n</code></pre>')
      expect(root.children[1].classList.contains('scripture-study-page-break')).toBe(true)
      expect(root.children[1].classList.contains('scripture-study-page-break-trailing')).toBe(true)
    })

    it('keeps a marker right under a heading from taking the Page Break that follows it', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<h1>Title</h1><p>===</p><p>real:</p><p>===</p>'

      await process(root, deps, '# Title\n===\n\nreal:\n\n===\n')

      expect(root.children[1].outerHTML).toBe('<p>===</p>')
      expect(root.children[3].classList.contains('scripture-study-page-break')).toBe(true)
      expect(root.children[3].classList.contains('scripture-study-page-break-trailing')).toBe(true)
    })

    it('keeps a marker right under a horizontal rule from taking the Page Break that follows it', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<hr><p>===</p><p>===</p><p>After.</p>'

      await process(root, deps, '---\n===\n\n===\n\nAfter.')

      expect(root.children[1].outerHTML).toBe('<p>===</p>')
      expect(root.children[2].classList.contains('scripture-study-page-break')).toBe(true)
      expect(root.children[2].classList.contains('scripture-study-page-break-trailing')).toBe(false)
    })

    it('keeps a marker in inline code from taking the Page Break that follows it', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p><code>===</code></p><p>===</p>'

      await process(root, deps, '`===`\n\n===\n')

      expect(root.children[0].outerHTML).toBe('<p><code>===</code></p>')
      expect(root.children[1].classList.contains('scripture-study-page-break')).toBe(true)
      expect(root.children[1].classList.contains('scripture-study-page-break-trailing')).toBe(true)
    })

    it('decorates a whole note in document order across other blocks', async () => {
      const { root, deps } = setup()
      root.innerHTML =
        '<h2>Head</h2><p>===</p><ul><li>item</li></ul><p>===</p><p>Tail.</p><p>===</p>'

      await processRenderedElement(
        root,
        context,
        deps,
        wholeNoteSection('## Head\n\n===\n\n- item\n\n===\n\nTail.\n\n===\n'),
      )

      const trailing = pageBreaks(root).map((element) =>
        element.classList.contains('scripture-study-page-break-trailing'),
      )
      expect(trailing).toEqual([false, false, true])
      expect([...root.children].map((child) => child.tagName)).toEqual([
        'H2',
        'DIV',
        'UL',
        'DIV',
        'P',
        'DIV',
      ])
    })

    it('still renders references beside a Page Break', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>{John 15:4}</p><p>===</p>'

      await process(root, deps, '{John 15:4}\n\n===')

      expect(chipLabels(root)).toEqual(['John 15:4'])
      expect(pageBreaks(root)).toHaveLength(1)
    })
  })
})
