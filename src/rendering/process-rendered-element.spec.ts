import { describe, expect, it, vi } from 'vitest'
import type { Passage } from './module-passage-source'
import {
  processRenderedElement,
  type RenderedSection,
} from './process-rendered-element'
import type { ReferenceRenderDeps } from './render-reference'
import type { RenderContext } from './reference-render-model'

const context: RenderContext = {
  knownTranslationIds: ['web'],
  defaultTranslationId: 'web',
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
) =>
  processRenderedElement(
    root,
    context,
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

  it('renders a relative block passage with its cue and no highlight editing', async () => {
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
    expect(editHighlights).not.toHaveBeenCalled()
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

    it('never decorates inside code or pre elements', async () => {
      const { root, deps } = setup()
      root.innerHTML =
        '<p>use <code>c"Abide"</code></p><pre><code>c"Abide"</code></pre>'

      await process(root, deps, 'use `c"Abide"`\n\n```\nc"Abide"\n```')

      expect(redLetterTexts(root)).toEqual([])
    })

    it('leaves a quote alone whose marks the source puts in a code span', async () => {
      const { root, deps } = setup()
      root.innerHTML = '<p>c"Abide <code>"</code> in me"</p>'

      await process(root, deps, 'c"Abide `"` in me"')

      expect(redLetterTexts(root)).toEqual([])
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
})
