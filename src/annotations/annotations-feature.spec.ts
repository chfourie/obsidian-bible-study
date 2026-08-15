import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MarkdownView, WorkspaceLeaf, type Plugin, type TFile } from 'obsidian'
import { Notice } from '../../tests/mocks/obsidian'
import { DEFAULT_SETTINGS } from '../data-access'
import { parseReference, type Reference } from '../reference'
import { VaultReferenceIndex } from '../vault-index'
import { AnnotationsFeature } from './annotations-feature'

const ref = (text: string): Reference => {
  const parsed = parseReference(text)
  if (parsed === null) throw new Error(`unparseable reference: ${text}`)
  return parsed.reference
}

const flushAsync = async (): Promise<void> => {
  await new Promise((resolve) => window.setTimeout(resolve, 0))
}

const harness = (seedNotes: Record<string, string> = {}) => {
  const notes = new Map(Object.entries(seedNotes))
  const folders = new Set<string>()
  const commands: { id: string; callback: () => void }[] = []
  const openedFiles: string[] = []
  const setCursor = vi.fn()
  const markdownView = new MarkdownView(new WorkspaceLeaf())
  markdownView.editor = { setCursor } as unknown as MarkdownView['editor']
  const splitLeaf = {
    openFile: async (file: TFile) => {
      openedFiles.push(file.path)
    },
    view: markdownView,
  }
  const vault = {
    getAbstractFileByPath: (path: string) =>
      notes.has(path) || folders.has(path) ? { path } : null,
    getFileByPath: (path: string) =>
      notes.has(path) ? { path, stat: { ctime: 0 } } : null,
    cachedRead: async (file: { path: string }) => notes.get(file.path) ?? '',
    create: async (path: string, content: string) => {
      notes.set(path, content)
      return { path }
    },
    createFolder: async (path: string) => {
      folders.add(path)
    },
  }
  const plugin = {
    app: {
      vault,
      workspace: { getLeaf: () => splitLeaf },
    },
    addCommand: (command: { id: string; callback: () => void }) => {
      commands.push(command)
      return command
    },
  } as unknown as Plugin
  const index = new VaultReferenceIndex()
  const feature = new AnnotationsFeature(plugin, index)
  feature.useSettings({ ...DEFAULT_SETTINGS })
  return {
    feature,
    index,
    notes,
    folders,
    commands,
    openedFiles,
    setCursor,
    plugin,
  }
}

describe('AnnotationsFeature', () => {
  beforeEach(() => {
    Notice.shownMessages = []
  })

  it('registers the new-annotation command on load', async () => {
    const { feature, commands } = harness()

    await feature.load()

    expect(commands.map((command) => command.id)).toEqual(['new-annotation'])
  })

  it('creates the annotation note in the configured folder', async () => {
    const { feature, notes, folders } = harness()

    await feature.annotate(ref('John 15:4-6,9'))

    expect(folders.has('Annotations')).toBe(true)
    expect(notes.get('Annotations/John 15.4-6,9.md')).toBe(
      '---\nref: John 15:4-6,9\n---\n\n',
    )
  })

  it('indexes the new annotation immediately', async () => {
    const { feature, index } = harness()

    await feature.annotate(ref('John 15:4'))

    const groups = index.intersectingOccurrences(ref('John 15:4'))
    expect(groups).toHaveLength(1)
    expect(groups[0].annotation).toBe(true)
    expect(groups[0].file).toBe('Annotations/John 15.4.md')
  })

  it('opens the new note in a split with the cursor on the first body line', async () => {
    const { feature, openedFiles, setCursor } = harness()

    await feature.annotate(ref('John 15:4'))

    expect(openedFiles).toEqual(['Annotations/John 15.4.md'])
    expect(setCursor).toHaveBeenCalledWith({ line: 3, ch: 0 })
  })

  it('copies the configured template into the new note', async () => {
    const { feature, notes } = harness({
      'Templates/Annotation.md': '## Observations\n',
    })
    feature.useSettings({
      ...DEFAULT_SETTINGS,
      annotationTemplatePath: 'Templates/Annotation.md',
    })

    await feature.annotate(ref('John 15:4'))

    expect(notes.get('Annotations/John 15.4.md')).toBe(
      '---\nref: John 15:4\n---\n## Observations\n',
    )
  })

  it('accepts any valid grammar string from the ref prompt', async () => {
    const { feature, notes } = harness()

    expect(feature.submitRefText('jhn 15:4')).toBe(true)
    await flushAsync()

    expect(notes.has('Annotations/John 15.4.md')).toBe(true)
  })

  it('rejects an invalid ref prompt entry without creating anything', async () => {
    const { feature, notes } = harness()

    expect(feature.submitRefText('Nonsense 99')).toBe(false)
    await flushAsync()

    expect(notes.size).toBe(0)
  })

  it('pre-fills the ref prompt from the reader selection', () => {
    const { feature } = harness()
    feature.usePrefill(() => ref('John 15:4-6'))

    expect(feature.prefillRefText()).toBe('John 15:4-6')
  })

  it('pre-fills nothing when no reader is open', () => {
    const { feature } = harness()

    expect(feature.prefillRefText()).toBe('')
  })

  it('surfaces a notice when annotation creation fails', async () => {
    const { feature, plugin } = harness()
    const vault = plugin.app.vault as unknown as {
      create: (path: string, content: string) => Promise<unknown>
    }
    vault.create = async () => {
      throw new Error('folder is a file')
    }

    await feature.annotate(ref('John 15:4'))

    expect(Notice.shownMessages).toEqual([
      'Failed to create annotation: folder is a file',
    ])
  })

  it('surfaces a notice when a submitted ref fails to create', async () => {
    const { feature, plugin } = harness()
    const vault = plugin.app.vault as unknown as {
      createFolder: (path: string) => Promise<void>
    }
    vault.createFolder = async () => {
      throw new Error('no permission')
    }

    expect(feature.submitRefText('John 15:4')).toBe(true)
    await flushAsync()

    expect(Notice.shownMessages).toEqual([
      'Failed to create annotation: no permission',
    ])
  })
})
