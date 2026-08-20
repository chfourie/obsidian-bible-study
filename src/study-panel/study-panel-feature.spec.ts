import { describe, expect, it, vi } from 'vitest'
import { TFile, WorkspaceLeaf, type Plugin, type View } from 'obsidian'
import type {
  SelectionKind,
  StudyMaterial,
  StudyMaterialProvider,
  StudyMaterialSource,
} from '../contracts'
import type { CrossReference } from '../cross-references'
import { DEFAULT_SETTINGS, type ScriptureStudySettings } from '../data-access'
import type { ModuleManifest, ModuleStore } from '../modules'
import { makeVerseId, parseReference, type Reference } from '../reference'
import { VaultReferenceIndex } from '../vault-index'
import { STUDY_PANEL_VIEW_TYPE, StudyPanelFeature } from './study-panel-feature'
import { StudyPanelView } from './study-panel-view'

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

type FakeCommand = { id: string; name: string; callback: () => void }

// A reader tab seen through the study-material contract: the panel never
// touches anything else about it.
const fakeStudyMaterial = () => {
  const listeners = new Set<() => void>()
  const selectionListeners = new Set<(kind: SelectionKind) => void>()
  let detailsWanted = false
  let material: StudyMaterial = {
    title: 'John 15',
    bookMode: false,
    selectedVerseId: null,
    selectionEndId: null,
    details: null,
    chapterCrossReferences: [],
    chapterAnnotations: [],
    chapterMentions: [],
    collection: null,
  }
  const source = {
    get studyMaterial(): StudyMaterial {
      return material
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    onSelection: (listener: (kind: SelectionKind) => void) => {
      selectionListeners.add(listener)
      return () => selectionListeners.delete(listener)
    },
    setDetailsWanted: (wanted: boolean) => {
      detailsWanted = wanted
    },
  } as unknown as StudyMaterialSource
  return {
    source,
    subscriptions: () => listeners.size,
    selectionSubscriptions: () => selectionListeners.size,
    detailsWanted: () => detailsWanted,
    select: (verseId: number) => {
      material = { ...material, selectedVerseId: verseId }
      selectionListeners.forEach((listener) => listener('verse'))
      listeners.forEach((listener) => listener())
    },
    tapWord: (verseId: number) => {
      material = { ...material, selectedVerseId: verseId }
      selectionListeners.forEach((listener) => listener('word'))
      listeners.forEach((listener) => listener())
    },
    collect: () => {
      material = {
        ...material,
        collection: {
          members: [],
          canAddSelection: false,
          canSave: false,
          error: null,
          editing: false,
          confirmingDelete: false,
          description: '',
          typedMember: '',
        },
      }
      listeners.forEach((listener) => listener())
    },
  }
}

const harness = (
  notes: Record<string, string> = {},
  settings: Partial<ScriptureStudySettings> = {},
) => {
  const readGates: Record<string, Promise<void>> = {}
  const leaves: FakeLeaf[] = []
  let factory: ((leaf: WorkspaceLeaf) => unknown) | null = null
  const revealLeaf = vi.fn(async () => {})
  const commands: FakeCommand[] = []
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
  // The main-area tabs, in focus order with the most recent last.
  const tabs: WorkspaceLeaf[] = []
  const workspace = {
    on,
    getActiveFile: () => activeFile,
    getLeavesOfType: (type: string) =>
      type === STUDY_PANEL_VIEW_TYPE
        ? leaves.filter((leaf) => !leaf.detached)
        : [],
    getRightLeaf: vi.fn(() => makeLeaf()),
    revealLeaf,
    getMostRecentLeaf: () => tabs[tabs.length - 1] ?? null,
    iterateAllLeaves: (callback: (leaf: WorkspaceLeaf) => void) => {
      ;[...leaves, ...tabs].forEach(callback)
    },
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
    addCommand: (command: FakeCommand) => {
      commands.push(command)
      return command
    },
    addRibbonIcon: (...args: unknown[]) => {
      ribbons.push(args)
      return document.createElement('div')
    },
    registerEvent: () => {},
  } as unknown as Plugin
  const readers = new Map<View, StudyMaterialSource>()
  const studyMaterial: StudyMaterialProvider = {
    studyMaterialFor: (view) => (view === null ? null : readers.get(view) ?? null),
  }
  const index = new VaultReferenceIndex()
  const feature = new StudyPanelFeature(plugin, fakeStore(), {
    studyMaterial,
    index,
  })
  feature.useSettings({
    ...DEFAULT_SETTINGS,
    defaultTranslationId: 'web',
    ...settings,
  })
  const announceFocus = (leaf: WorkspaceLeaf | null) => {
    handlers['active-leaf-change']?.forEach((handler) =>
      (handler as (leaf: WorkspaceLeaf | null) => void)(leaf),
    )
  }
  const focusTab = (leaf: WorkspaceLeaf) => {
    const index = tabs.indexOf(leaf)
    if (index >= 0) tabs.splice(index, 1)
    tabs.push(leaf)
    const file = (leaf.view as { file?: unknown }).file
    if (file instanceof TFile) activeFile = file
    announceFocus(leaf)
  }
  const focusLeaf = (view: View | null) => {
    if (view === null) {
      announceFocus(null)
      return null
    }
    const leaf = { view } as unknown as WorkspaceLeaf
    focusTab(leaf)
    return leaf
  }
  const focusReader = () => {
    const reader = fakeStudyMaterial()
    const view = {} as View
    readers.set(view, reader.source)
    return { ...reader, leaf: focusLeaf(view) as WorkspaceLeaf }
  }
  const focusNote = (path: string) =>
    focusLeaf({ file: note(path) } as unknown as View) as WorkspaceLeaf
  // A reader tab whose view is not yet resolvable as study material, as on a
  // cold start where the leaf takes focus before its view is in place.
  const focusPendingReader = () => {
    const view = {} as View
    const leaf = { view } as unknown as WorkspaceLeaf
    focusTab(leaf)
    return {
      leaf,
      attach: () => {
        const reader = fakeStudyMaterial()
        readers.set(view, reader.source)
        return reader
      },
    }
  }
  // Obsidian can settle the layout before it has caught up on which tab is
  // most recent, which `staleRecent` stands in for.
  const layoutChanged = (staleRecent?: WorkspaceLeaf) => {
    const recent = workspace.getMostRecentLeaf
    if (staleRecent !== undefined) workspace.getMostRecentLeaf = () => staleRecent
    handlers['layout-change']?.forEach((handler) => handler())
    workspace.getMostRecentLeaf = recent
  }
  const closeTab = (leaf: WorkspaceLeaf) => {
    const index = tabs.indexOf(leaf)
    if (index >= 0) tabs.splice(index, 1)
    handlers['layout-change']?.forEach((handler) => handler())
  }
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
    focusLeaf,
    focusTab,
    closeTab,
    focusReader,
    focusPendingReader,
    layoutChanged,
    focusNote,
    editNote,
    readGates,
    indexNote: (path: string) => index.indexNote(path, notes[path] ?? ''),
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

const panelView = (leaf: FakeLeaf): StudyPanelView => {
  const view = leaf.view as unknown as StudyPanelView
  expect(view).toBeInstanceOf(StudyPanelView)
  return view
}

describe('StudyPanelFeature entry points', () => {
  it('registers the view and a command but no ribbon icon', async () => {
    const { feature, commands, ribbons } = harness()

    await feature.load()

    expect(commands.map((command) => [command.id, command.name])).toEqual([
      ['open-study-panel', 'Open study panel'],
    ])
    expect(ribbons).toEqual([])
  })

  it('names the view the study panel', async () => {
    const { feature, commands, leaves } = harness()
    await feature.load()

    commands[0].callback()
    await flushAsync()

    const view = panelView(leaves[0])
    expect(view.getViewType()).toBe(STUDY_PANEL_VIEW_TYPE)
    expect(view.getDisplayText()).toBe('Study panel')
  })

  it('opens the panel in the right sidebar and reveals it', async () => {
    const { feature, commands, leaves, revealLeaf, workspace } = harness()
    await feature.load()

    commands[0].callback()
    await flushAsync()

    expect(workspace.getRightLeaf).toHaveBeenCalledWith(false)
    expect(leaves).toHaveLength(1)
    expect(panelView(leaves[0])).toBeInstanceOf(StudyPanelView)
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
    const opened: [Reference, string | null, boolean | undefined][] = []
    feature.useNavigator({
      openReference: (reference, translationId, options) =>
        opened.push([reference, translationId, options?.newPane]),
      openNote: () => {},
      editCrossReference: () => {},
    })

    feature.openReference(ref('John 15:1'), 'kjv')
    feature.openReference(ref('John 15:1'), null, { newPane: true })

    expect(opened).toEqual([
      [ref('John 15:1'), 'kjv', undefined],
      [ref('John 15:1'), null, true],
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

  it('mirrors a reader tab as it gains focus', async () => {
    const { feature, commands, leaves, focusReader } = harness()
    await feature.load()
    commands[0].callback()
    await flushAsync()

    const reader = focusReader()

    const view = panelView(leaves[0])
    expect(view.model.studySource).toBe(reader.source)
    expect(view.model.view.studyMaterial).toEqual(reader.source.studyMaterial)
  })

  it('keeps the reader when a note read outruns the reader gaining focus', async () => {
    const { feature, commands, leaves, focusNote, focusReader, readGates } =
      harness({ 'slow.md': '{John 15:1}' })
    let releaseSlow: () => void = () => {}
    readGates['slow.md'] = new Promise((resolve) => {
      releaseSlow = resolve
    })
    await feature.load()
    commands[0].callback()
    await flushAsync()

    focusNote('slow.md')
    const reader = focusReader()
    releaseSlow()
    await flushAsync()

    const view = panelView(leaves[0])
    expect(view.model.studySource).toBe(reader.source)
    expect(view.model.view.studyMaterial).toEqual(reader.source.studyMaterial)
  })

  it('adopts a reader whose view lands after the tab took focus', async () => {
    const { feature, commands, leaves, focusPendingReader, layoutChanged } =
      harness()
    await feature.load()
    commands[0].callback()
    await flushAsync()

    const pending = focusPendingReader()
    const reader = pending.attach()
    layoutChanged()

    const view = panelView(leaves[0])
    expect(view.model.studySource).toBe(reader.source)
  })

  it('stays with a note focused off a reader as the layout settles', async () => {
    const {
      feature,
      commands,
      leaves,
      focusReader,
      focusNote,
      layoutChanged,
      readGates,
    } = harness({ 'slow.md': '{John 15:1}' })
    let releaseSlow: () => void = () => {}
    readGates['slow.md'] = new Promise((resolve) => {
      releaseSlow = resolve
    })
    await feature.load()
    commands[0].callback()
    await flushAsync()
    const reader = focusReader()

    focusNote('slow.md')
    layoutChanged(reader.leaf)
    releaseSlow()
    await flushAsync()

    const view = panelView(leaves[0])
    expect(view.model.view.studyMaterial).toBe(null)
    expect(view.model.view.file).toBe('slow.md')
  })

  it('follows the mirrored reader as its selection changes', async () => {
    const { feature, commands, leaves, focusReader } = harness()
    await feature.load()
    commands[0].callback()
    await flushAsync()
    const reader = focusReader()

    reader.select(makeVerseId(43, 15, 1))

    expect(panelView(leaves[0]).model.view.studyMaterial?.selectedVerseId).toBe(
      makeVerseId(43, 15, 1),
    )
  })

  it('seeds a panel opened while a reader tab holds focus', async () => {
    const { feature, commands, leaves, focusReader } = harness()
    await feature.load()
    const reader = focusReader()

    commands[0].callback()
    await flushAsync()

    expect(panelView(leaves[0]).model.studySource).toBe(reader.source)
  })

  it('restores the note view when a note tab regains focus', async () => {
    const { feature, commands, leaves, focusReader, focusNote } = harness({
      'a.md': '{John 15:1}',
    })
    await feature.load()
    commands[0].callback()
    await flushAsync()
    focusReader()

    focusNote('a.md')
    await flushAsync()

    const view = panelView(leaves[0])
    expect(view.model.view.studyMaterial).toBe(null)
    expect(view.model.view.file).toBe('a.md')
  })

  it('keeps the reader view when a non-document leaf gains focus', async () => {
    const { feature, commands, leaves, focusReader, focusLeaf } = harness()
    await feature.load()
    commands[0].callback()
    await flushAsync()
    const reader = focusReader()

    focusLeaf({} as never)
    focusLeaf(null)
    await flushAsync()

    expect(panelView(leaves[0]).model.studySource).toBe(reader.source)
  })

  it('mirrors the reader tab focused last', async () => {
    const { feature, commands, leaves, focusReader } = harness()
    await feature.load()
    commands[0].callback()
    await flushAsync()
    const first = focusReader()

    const second = focusReader()

    expect(panelView(leaves[0]).model.studySource).toBe(second.source)
    expect(first.subscriptions()).toBe(0)
  })

  it('stops mirroring a reader once the panel closes', async () => {
    const { feature, commands, leaves, focusReader } = harness()
    await feature.load()
    commands[0].callback()
    await flushAsync()
    const reader = focusReader()

    feature.releaseModel(panelView(leaves[0]).model)

    expect(reader.subscriptions()).toBe(0)
  })

  it('restores each note tab’s fold state as focus moves between them', async () => {
    const { feature, commands, leaves, focusNote, focusTab } = harness({
      'a.md': '{John 15:1}',
      'b.md': '{Genesis 1:1}',
    })
    await feature.load()
    commands[0].callback()
    await flushAsync()
    const first = focusNote('a.md')
    await flushAsync()
    const view = panelView(leaves[0])
    view.model.toggleFold(view.model.view.entries[0].key)
    const second = focusNote('b.md')
    await flushAsync()

    expect([...view.model.view.folded]).toEqual(['|Genesis 1:1'])

    focusTab(first)
    await flushAsync()
    expect([...view.model.view.folded]).toEqual([])

    focusTab(second)
    await flushAsync()
    expect([...view.model.view.folded]).toEqual(['|Genesis 1:1'])
  })

  it('restores each reader tab’s sub-tab as focus moves between them', async () => {
    const { feature, commands, leaves, focusReader, focusTab } = harness()
    await feature.load()
    commands[0].callback()
    await flushAsync()
    const first = focusReader()
    const view = panelView(leaves[0])
    view.model.selectSubTab('selection')
    const second = focusReader()

    expect(view.model.view.subTab).toBe('chapter')

    focusTab(first.leaf)
    expect(view.model.view.subTab).toBe('selection')
    expect(first.detailsWanted()).toBe(true)

    focusTab(second.leaf)
    expect(view.model.view.subTab).toBe('chapter')
    expect(first.detailsWanted()).toBe(false)
  })

  it('switches to the translations tab when a word is tapped, not on a verse pick', async () => {
    const { feature, commands, leaves, focusReader } = harness()
    await feature.load()
    commands[0].callback()
    await flushAsync()
    const reader = focusReader()
    const view = panelView(leaves[0])

    reader.select(makeVerseId(43, 15, 1))
    expect(view.model.view.subTab).toBe('chapter')

    reader.tapWord(makeVerseId(43, 15, 1))
    expect(view.model.view.subTab).toBe('selection')
  })

  it('opens on the translations tab when a word is tapped with the panel closed', async () => {
    const { feature, commands, leaves, focusReader } = harness(
      {},
      { revealPanelOnSelection: false },
    )
    await feature.load()
    const reader = focusReader()

    reader.tapWord(makeVerseId(43, 15, 1))
    commands[0].callback()
    await flushAsync()

    expect(panelView(leaves[0]).model.view.subTab).toBe('selection')
  })

  it('keeps two tabs on the same note independent', async () => {
    const { feature, commands, leaves, focusNote, focusTab } = harness({
      'a.md': '{John 15:1}',
    })
    await feature.load()
    commands[0].callback()
    await flushAsync()
    const first = focusNote('a.md')
    await flushAsync()
    const view = panelView(leaves[0])
    view.model.toggleFold(view.model.view.entries[0].key)

    const second = focusNote('a.md')
    await flushAsync()
    expect([...view.model.view.folded]).toEqual(['|John 15:1'])

    focusTab(first)
    await flushAsync()
    expect([...view.model.view.folded]).toEqual([])

    focusTab(second)
    await flushAsync()
    expect([...view.model.view.folded]).toEqual(['|John 15:1'])
  })

  it('forgets a tab’s state once it closes', async () => {
    const { feature, commands, leaves, focusNote, closeTab } = harness({
      'a.md': '{John 15:1}',
    })
    await feature.load()
    commands[0].callback()
    await flushAsync()
    const tab = focusNote('a.md')
    await flushAsync()
    const view = panelView(leaves[0])
    view.model.toggleFold(view.model.view.entries[0].key)

    closeTab(tab)
    focusNote('a.md')
    await flushAsync()

    expect([...view.model.view.folded]).toEqual(['|John 15:1'])
  })

  it('falls back to the most recent tab when the mirrored tab closes', async () => {
    const { feature, commands, leaves, focusNote, focusReader, closeTab } =
      harness({ 'a.md': '{John 15:1}' })
    await feature.load()
    commands[0].callback()
    await flushAsync()
    focusNote('a.md')
    await flushAsync()
    const reader = focusReader()

    closeTab(reader.leaf)
    await flushAsync()

    const view = panelView(leaves[0])
    expect(view.model.view.studyMaterial).toBe(null)
    expect(view.model.view.file).toBe('a.md')
  })

  it('falls back to the empty state when the last tab closes', async () => {
    const { feature, commands, leaves, focusNote, closeTab } = harness({
      'a.md': '{John 15:1}',
    })
    await feature.load()
    commands[0].callback()
    await flushAsync()
    const tab = focusNote('a.md')
    await flushAsync()

    closeTab(tab)
    await flushAsync()

    expect(panelView(leaves[0]).model.view.status).toBe('no-note')
  })

  it('routes annotation prompts through the injected prompter', async () => {
    const { feature } = harness()
    const prompted: Reference[] = []
    feature.useAnnotationPrompt((prefill) => prompted.push(prefill))

    feature.promptAnnotation(ref('John 15'))

    expect(prompted).toEqual([ref('John 15')])
  })

  it('edits a cross-reference in its own pane through the navigator', async () => {
    const { feature } = harness()
    const edited: [CrossReference, string | null, boolean | undefined][] = []
    feature.useNavigator({
      openReference: () => {},
      openNote: () => {},
      editCrossReference: (entry, translationId, options) =>
        edited.push([entry, translationId, options?.newPane]),
    })
    const entry: CrossReference = {
      id: 'xr-vine',
      members: [ref('John 15:1')],
      description: null,
    }

    feature.editCrossReferenceInNewPane(entry)

    expect(edited).toEqual([[entry, 'web', true]])
  })

  it('opens a note through the injected navigator', async () => {
    const { feature } = harness()
    const opened: string[] = []
    feature.useNavigator({
      openReference: () => {},
      openNote: (file) => opened.push(file),
      editCrossReference: () => {},
    })

    feature.openNote('Sermons/Vine.md')

    expect(opened).toEqual(['Sermons/Vine.md'])
  })

  it('refreshes annotations and mentions when the vault index changes', async () => {
    const { feature, commands, leaves, focusNote, indexNote } = harness({
      'a.md': '{John 15:1}',
      'Sermons/Abiding.md': 'On {John 15:1}.',
    })
    await feature.load()
    commands[0].callback()
    await flushAsync()
    focusNote('a.md')
    await flushAsync()
    const view = panelView(leaves[0])
    expect(view.model.view.mentions).toEqual([])

    indexNote('Sermons/Abiding.md')
    await flushAsync()

    expect(view.model.view.mentions.map((item) => item.file)).toEqual([
      'Sermons/Abiding.md',
    ])
  })

  it('reads indexed annotation bodies through the vault', async () => {
    const { feature, commands, leaves, focusNote, indexNote } = harness({
      'a.md': '{John 15:1}',
      'Annotations/John 15.1.md': '---\nref: John 15:1\n---\nThe true vine.',
    })
    indexNote('Annotations/John 15.1.md')
    await feature.load()
    commands[0].callback()
    await flushAsync()

    focusNote('a.md')
    await flushAsync()

    expect(panelView(leaves[0]).model.view.annotations).toEqual([
      {
        file: 'Annotations/John 15.1.md',
        label: 'John 15:1',
        body: 'The true vine.',
      },
    ])
  })

  it('stops refreshing on index changes once unloaded', async () => {
    const { feature, commands, leaves, focusNote, indexNote } = harness({
      'a.md': '{John 15:1}',
      'Sermons/Abiding.md': 'On {John 15:1}.',
    })
    await feature.load()
    commands[0].callback()
    await flushAsync()
    focusNote('a.md')
    await flushAsync()

    feature.unload()
    indexNote('Sermons/Abiding.md')
    await flushAsync()

    expect(panelView(leaves[0]).model.view.mentions).toEqual([])
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

describe('revealing the panel on selection', () => {
  it('opens and reveals a closed panel when a verse is selected', async () => {
    const { feature, leaves, revealLeaf, focusReader } = harness()
    await feature.load()
    const reader = focusReader()

    reader.select(makeVerseId(43, 15, 1))
    await flushAsync()

    expect(leaves).toHaveLength(1)
    expect(panelView(leaves[0]).model.studySource).toBe(reader.source)
    expect(revealLeaf).toHaveBeenCalled()
  })

  it('reveals a panel that is already open', async () => {
    const { feature, commands, leaves, revealLeaf, focusReader } = harness()
    await feature.load()
    commands[0].callback()
    await flushAsync()
    const reader = focusReader()
    revealLeaf.mockClear()

    reader.select(makeVerseId(43, 15, 1))
    await flushAsync()

    expect(leaves).toHaveLength(1)
    expect(revealLeaf).toHaveBeenCalled()
  })

  it('opens nothing on selection when the setting is off', async () => {
    const { feature, leaves, revealLeaf, focusReader } = harness(
      {},
      { revealPanelOnSelection: false },
    )
    await feature.load()
    const reader = focusReader()

    reader.select(makeVerseId(43, 15, 1))
    await flushAsync()

    expect(leaves).toEqual([])
    expect(revealLeaf).not.toHaveBeenCalled()
  })

  it('still updates an open panel on selection when the setting is off', async () => {
    const { feature, commands, leaves, focusReader } = harness(
      {},
      { revealPanelOnSelection: false },
    )
    await feature.load()
    commands[0].callback()
    await flushAsync()
    const reader = focusReader()

    reader.select(makeVerseId(43, 15, 1))
    await flushAsync()

    expect(leaves).toHaveLength(1)
    expect(panelView(leaves[0]).model.view.studyMaterial?.selectedVerseId).toBe(
      makeVerseId(43, 15, 1),
    )
  })

  it('never reveals on focus changes, material changes or note edits', async () => {
    const { feature, leaves, focusReader, focusNote, editNote } = harness({
      'a.md': '{John 15:1}',
    })
    await feature.load()

    const reader = focusReader()
    reader.collect()
    focusNote('a.md')
    editNote('a.md', '{John 15:2}')
    await flushAsync()

    expect(leaves).toEqual([])
  })

  it('stops revealing for a reader the panel no longer follows', async () => {
    const { feature, leaves, focusReader, focusNote } = harness({
      'a.md': '{John 15:1}',
    })
    await feature.load()
    const reader = focusReader()

    focusNote('a.md')
    await flushAsync()
    reader.select(makeVerseId(43, 15, 1))
    await flushAsync()

    expect(leaves).toEqual([])
    expect(reader.selectionSubscriptions()).toBe(0)
  })
})
