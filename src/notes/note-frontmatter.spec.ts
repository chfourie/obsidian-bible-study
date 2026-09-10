import { describe, expect, it } from 'vitest'
import { splitTemplate, withFrontmatterKeys } from './note-frontmatter'

describe('splitTemplate', () => {
  it('gives empty frontmatter and a blank body without a template', () => {
    expect(splitTemplate(null)).toEqual({ frontmatter: '---\n---\n', body: '\n' })
  })

  it('treats a frontmatter-less template as all body', () => {
    expect(splitTemplate('## Why\n')).toEqual({
      frontmatter: '---\n---\n',
      body: '## Why\n',
    })
  })

  it('splits a template at the end of its frontmatter', () => {
    expect(splitTemplate('---\ntags: study\n---\nBody\n')).toEqual({
      frontmatter: '---\ntags: study\n---\n',
      body: 'Body\n',
    })
  })
})

describe('withFrontmatterKeys', () => {
  it('appends keys the frontmatter lacks, in the order given', () => {
    expect(
      withFrontmatterKeys('---\ntags: study\n---\n', [
        ['type', ['type: note']],
        ['refs', ['refs:', '  - John 15:4']],
      ]),
    ).toBe('---\ntags: study\ntype: note\nrefs:\n  - John 15:4\n---\n')
  })

  it('replaces a key and its list items in place', () => {
    expect(
      withFrontmatterKeys('---\nrefs:\n  - Genesis 1:1\n  - Exodus 2:2\ntags: study\n---\n', [
        ['refs', ['refs:', '  - John 15:4']],
      ]),
    ).toBe('---\nrefs:\n  - John 15:4\ntags: study\n---\n')
  })

  it('leaves the frontmatter as it was without keys', () => {
    expect(withFrontmatterKeys('---\ntags: study\n---\n', [])).toBe(
      '---\ntags: study\n---\n',
    )
  })
})
