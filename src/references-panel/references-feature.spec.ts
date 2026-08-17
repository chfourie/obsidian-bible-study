import { describe, expect, it, vi } from 'vitest'
import { TFile, WorkspaceLeaf, type Plugin } from 'obsidian'
import { DEFAULT_SETTINGS } from '../data-access'
import type { ModuleManifest, ModuleStore } from '../modules'
import { makeVerseId, parseReference, type Reference } from '../reference'
import { REFERENCES_VIEW_TYPE, ReferencesFeature } from './references-feature'
import { ReferencesView } from './references-view'

const manifest = (id: string): ModuleManifest => ({
  id,
  name: id.toUpperCase(),
  language: 'en',
  license: 'Public Domain',
  source: 'test',
  sourceChecksum: '',
  formatVersion: 1,
  capabilities: { strongsTagged: false },
})

const fakeStore = (): ModuleStore =>
  ({
    installedManifests: async () => [manifest('web')],
    manifest: async (moduleId: string) =>
      moduleId === 'web' ? manifest('web') : null,
    bookContent: async (moduleId: string, book: number) =>
      moduleId === 'web' && book === 43
        ? { [makeVerseId(43, 15, 1)]: 'I am the true vine.' }
        : {},
  }) as unknown as ModuleStore

const note = (path: string): TFile => {
  const file = new TFile()
  file.path = path
  return file
}

type FakeLeaf = WorkspaceLeaf & { detached?: boolean }

const harness = (notes: Record<string, string> = {}) => {
  const readGates: Record<string, Promise<void>> = {}
  const leaves: FakeLeaf[] = []
  let factory: ((leaf: WorkspaceLeaf) => unknown) | null = null
  const revealLeaf = vi.fn(async () => {})
  const commands: { id: string; callback: () => void }[] = []
  const ribbons: unknown[] = []
  const handlers: Record<string, ((...args: never[]) => void)[]> = {}
  const on = (name: string, callback: (...args: never[]) => void) => {
    handlers[name] = [...(handlers[name] ?? []), callback]
    return { name }
  }
  let activeFile: TFile | null = null
  const makeLeaf = (): FakeLeaf => {
    const leaf = new WorkspaceLeaf() as FakeLeaf
    leaf.setViewState = async () => {
      if (factory) leaf.view = factory(leaf) as WorkspaceLeaf['view']
      leaves.push(leaf)
    }
    return leaf
  }
  const workspace = {
    on,
    getActiveFile: () => activeFile,
    getLeavesOfType: (type: string) =>
      type === REFERENCES_VIEW_TYPE
        ? leaves.filter((leaf) => !leaf.detached)
        : [],
    getRightLeaf: vi.fn(() => makeLeaf()),
    revealLeaf,
  }
  const metadataCache = { on }
  const vault = {
    getFileByPath: (path: string) => (path in notes ? note(path) : null),
    cachedRead: async (file: { path: string }) => {
      await readGates[file.path]
      return notes[file.path] ?? ''
    },
  }
  const plugin = {
    app: { workspace, vault, metadataCache },
    registerView: (
      _type: string,
      viewFactory: (leaf: WorkspaceLeaf) => unknown,
    ) => {
      factory = viewFactory
    },
    addCommand: (command: { id: string; callback: () => void }) => {
      commands.push(command)
      return command
    },
    addRibbonIcon: (...args: unknown[]) => {
      ribbons.push(args)
      return document.createElement('div')
    },
    registerEvent: () => {},
  } as unknown as Plugin
  const feature = new ReferencesFeature(plugin, fakeStore())
  feature.useSettings({ ...DEFAULT_SETTINGS, defaultTranslationId: 'web' })
  const openFile = (file: TFile | null) => {
    activeFile = file
    handlers['file-open']?.forEach((handler) =>
      (handler as (file: TFile | null) => void)(file),
    )
  }
  const editNote = (path: string, content: string) => {
    notes[path] = content
    handlers['changed']?.forEach((handler) =>
      (handler as (file: TFile, data: string) => void)(note(path), content),
    )
  }
  return {
    feature,
    leaves,
    commands,
    ribbons,
    revealLeaf,
    workspace,
    openFile,
    editNote,
    readGates,
    setActiveFile: (file: TFile | null) => {
      activeFile = file
    },
  }
}

const ref = (text: string): Reference => {
  const parsed = parseReference(text, { translationIds: [] })
  if (parsed === null) throw new Error(`unparseable reference: ${text}`)
  return parsed.reference
}

const flushAsync = async (): Promise<void> => {
  await new Promise((resolve) => window.setTimeout(resolve, 0))
}

const panelView = (leaf: FakeLeaf): ReferencesView => {
  const view = leaf.view as unknown as ReferencesView
  expect(view).toBeInstanceOf(ReferencesView)
  return view
}

describe('ReferencesFeature entry points', () => {
  it('registers the view and a command but no ribbon icon', async () => {
    const { feature, commands, ribbons } = harness()

    await feature.load()

    expect(commands.map((command) => command.id)).toEqual([
      'open-references-panel',
    ])
    expect(ribbons).toEqual([])
  })

  it('opens the panel in the right sidebar and reveals it', async () => {
    const { feature, commands, leaves, revealLeaf, workspace } = harness()
    await feature.load()

    commands[0].callback()
    await flushAsync()

    expect(workspace.getRightLeaf).toHaveBeenCalledWith(false)
    expect(leaves).toHaveLength(1)
    expect(panelView(leaves[0])).toBeInstanceOf(ReferencesView)
    expect(revealLeaf).toHaveBeenCalled()
  })

  it('reveals an existing panel instead of opening a second one', async () => {
    const { feature, commands, leaves } = harness()
    await feature.load()
    commands[0].callback()
    await flushAsync()

    commands[0].callback()
    await flushAsync()

    expect(leaves).toHaveLength(1)
  })

  it('seeds a new panel with the note active at load time', async () => {
    const { feature, commands, leaves, setActiveFile } = harness({
      'Sermons/Vine.md': 'On {John 15:1}.',
    })
    setActiveFile(note('Sermons/Vine.md'))
    await feature.load()
    await flushAsync()

    commands[0].callback()
    await flushAsync()

    const view = panelView(leaves[0])
    expect(view.model.view.file).toBe('Sermons/Vine.md')
    expect(view.model.view.entries.map((entry) => entry.label)).toEqual([
      'John 15:1',
    ])
    expect(view.model.view.entries[0].verses[0].text).toBe(
      'I am the true vine.',
    )
  })

  it('follows the active note as files open', async () => {
    const { feature, commands, leaves, openFile } = harness({
      'a.md': '{John 15:1}',
      'b.md': '{Genesis 1:1}',
    })
    await feature.load()
    commands[0].callback()
    await flushAsync()
    const view = panelView(leaves[0])

    openFile(note('a.md'))
    await flushAsync()
    expect(view.model.view.file).toBe('a.md')

    openFile(note('b.md'))
    await flushAsync()
    expect(view.model.view.file).toBe('b.md')
    expect(view.model.view.entries.map((entry) => entry.label)).toEqual([
      'Genesis 1:1',
    ])
  })

  it('keeps the last note when a non-file leaf gains focus', async () => {
    const { feature, commands, leaves, openFile } = harness({
      'a.md': '{John 15:1}',
    })
    await feature.load()
    commands[0].callback()
    await flushAsync()
    openFile(note('a.md'))
    await flushAsync()

    openFile(null)
    await flushAsync()

    expect(panelView(leaves[0]).model.view.file).toBe('a.md')
  })

  it('shows the later note when file switches outrun their reads', async () => {
    const { feature, commands, leaves, openFile, readGates } = harness({
      'slow.md': '{John 15:1}',
      'fast.md': '{Genesis 1:1}',
    })
    let releaseSlow: () => void = () => {}
    readGates['slow.md'] = new Promise((resolve) => {
      releaseSlow = resolve
    })
    await feature.load()
    commands[0].callback()
    await flushAsync()

    openFile(note('slow.md'))
    openFile(note('fast.md'))
    await flushAsync()
    releaseSlow()
    await flushAsync()

    const view = panelView(leaves[0])
    expect(view.model.view.file).toBe('fast.md')
    expect(view.model.view.entries.map((entry) => entry.label)).toEqual([
      'Genesis 1:1',
    ])
  })

  it('refreshes when the active note is edited', async () => {
    const { feature, commands, leaves, openFile, editNote } = harness({
      'a.md': '{John 15:1}',
    })
    await feature.load()
    commands[0].callback()
    await flushAsync()
    openFile(note('a.md'))
    await flushAsync()

    editNote('a.md', '{John 15:1} and {Genesis 1:1}')
    await flushAsync()

    expect(
      panelView(leaves[0]).model.view.entries.map((entry) => entry.label),
    ).toEqual(['John 15:1', 'Genesis 1:1'])
  })

  it('ignores edits to notes that are not active', async () => {
    const { feature, commands, leaves, openFile, editNote } = harness({
      'a.md': '{John 15:1}',
      'other.md': '',
    })
    await feature.load()
    commands[0].callback()
    await flushAsync()
    openFile(note('a.md'))
    await flushAsync()

    editNote('other.md', '{Genesis 1:1}')
    await flushAsync()

    expect(
      panelView(leaves[0]).model.view.entries.map((entry) => entry.label),
    ).toEqual(['John 15:1'])
  })

  it('applies a changed default translation to open panels', async () => {
    const { feature, commands, leaves, openFile } = harness({
      'a.md': '{John 15:1}',
    })
    await feature.load()
    commands[0].callback()
    await flushAsync()
    openFile(note('a.md'))
    await flushAsync()

    feature.useSettings({ ...DEFAULT_SETTINGS, defaultTranslationId: null })
    feature.onSettingsChanged()
    await flushAsync()

    expect(panelView(leaves[0]).model.view.status).toBe('no-translation')
  })

  it('routes reference opens through the injected navigator', async () => {
    const { feature } = harness()
    const opened: [Reference, string | null][] = []
    feature.useNavigator({
      openReference: (reference, translationId) =>
        opened.push([reference, translationId]),
      openNote: () => {},
      editCrossReference: () => {},
    })

    feature.openReference(ref('John 15:1'), 'kjv')
    feature.openReference(ref('John 15:1'), null)

    expect(opened).toEqual([
      [ref('John 15:1'), 'kjv'],
      [ref('John 15:1'), null],
    ])
  })

  it('recognizes well-known translation tokens when extracting', async () => {
    const { feature, commands, leaves, openFile } = harness({
      'a.md': '{John 15:1 kjv}',
    })
    await feature.load()
    commands[0].callback()
    await flushAsync()

    openFile(note('a.md'))
    await flushAsync()

    const entry = panelView(leaves[0]).model.view.entries[0]
    expect(entry.translation).toBe('kjv')
    expect(entry.translationLabel).toBe('KJV')
  })

  it('releases models when the view closes', async () => {
    const { feature, commands, leaves, openFile } = harness({
      'a.md': '{John 15:1}',
    })
    await feature.load()
    commands[0].callback()
    await flushAsync()
    const view = panelView(leaves[0])

    feature.releaseModel(view.model)
    openFile(note('a.md'))
    await flushAsync()

    expect(view.model.view.status).toBe('no-note')
  })
})
