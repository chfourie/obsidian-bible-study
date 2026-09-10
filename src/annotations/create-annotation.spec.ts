import { describe, expect, it } from 'vitest'
import { ref } from '../../tests/fixtures/reference'
import { fakeNoteFileVault } from '../../tests/fixtures/note-file-vault'
import { createAnnotation } from './create-annotation'

describe('createAnnotation', () => {
  it('creates a ref-frontmattered note in the annotations folder', async () => {
    const vault = fakeNoteFileVault()

    const created = await createAnnotation(vault, ref('John 15:4-6,9'), {
      folder: 'Annotations',
      templatePath: null,
    })

    expect(created).toEqual({
      path: 'Annotations/John 15.4-6,9.md',
      cursorLine: 3,
      content: '---\nref: John 15:4-6,9\n---\n\n',
    })
    expect(vault.folders.has('Annotations')).toBe(true)
    expect(vault.notes.get('Annotations/John 15.4-6,9.md')).toBe(
      '---\nref: John 15:4-6,9\n---\n\n',
    )
  })

  it('suffixes the filename when the canonical name is taken', async () => {
    const vault = fakeNoteFileVault({
      notes: { 'Annotations/John 15.4.md': 'existing' },
    })

    const created = await createAnnotation(vault, ref('John 15:4'), {
      folder: 'Annotations',
      templatePath: null,
    })

    expect(created.path).toBe('Annotations/John 15.4 1.md')
  })

  it('copies the configured template body into the new note', async () => {
    const vault = fakeNoteFileVault({
      notes: { 'Templates/Annotation.md': '## Observations\n' },
    })

    const created = await createAnnotation(vault, ref('John 15:4'), {
      folder: 'Annotations',
      templatePath: 'Templates/Annotation.md',
    })

    expect(created.content).toBe('---\nref: John 15:4\n---\n## Observations\n')
  })

  it('falls back to the bare note when the template file is missing', async () => {
    const vault = fakeNoteFileVault()

    const created = await createAnnotation(vault, ref('John 15:4'), {
      folder: 'Annotations',
      templatePath: 'Templates/Gone.md',
    })

    expect(created.content).toBe('---\nref: John 15:4\n---\n\n')
  })
})
