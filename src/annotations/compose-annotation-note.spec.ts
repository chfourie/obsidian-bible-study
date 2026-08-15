import { describe, expect, it } from 'vitest'
import { parseReference, type Reference } from '../reference'
import { composeAnnotationNote } from './compose-annotation-note'

const ref = (text: string): Reference => {
  const parsed = parseReference(text)
  if (parsed === null) throw new Error(`unparseable reference: ${text}`)
  return parsed.reference
}

describe('composeAnnotationNote', () => {
  it('writes canonical ref frontmatter and an empty body without a template', () => {
    expect(composeAnnotationNote(ref('John 15:4-6,9'), null)).toEqual({
      content: '---\nref: John 15:4-6,9\n---\n\n',
      cursorLine: 3,
    })
  })

  it('copies a frontmatter-less template as the body', () => {
    const { content, cursorLine } = composeAnnotationNote(
      ref('John 15:4'),
      '## Observations\n\n## Application\n',
    )

    expect(content).toBe(
      '---\nref: John 15:4\n---\n## Observations\n\n## Application\n',
    )
    expect(cursorLine).toBe(3)
  })

  it('overwrites a ref key already present in the template frontmatter', () => {
    const { content } = composeAnnotationNote(
      ref('John 15:4'),
      '---\nref: Genesis 1:1\ntags: study\n---\nBody line\n',
    )

    expect(content).toBe('---\nref: John 15:4\ntags: study\n---\nBody line\n')
  })

  it('adds the ref key to template frontmatter that lacks one', () => {
    const { content, cursorLine } = composeAnnotationNote(
      ref('John 15:4'),
      '---\ntags: study\n---\nBody line\n',
    )

    expect(content).toBe('---\ntags: study\nref: John 15:4\n---\nBody line\n')
    expect(cursorLine).toBe(4)
  })
})
