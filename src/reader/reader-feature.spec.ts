import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Platform, WorkspaceLeaf, type Plugin, type View } from 'obsidian'
import { DEFAULT_SETTINGS } from '../data-access'
import {
  deregisterManifestBook,
  registerManifestBook,
  type ModuleManifest,
  type ModuleStore,
} from '../modules'
import { makeVerseId, parseReference, type Reference } from '../reference'
import { VaultReferenceIndex } from '../vault-index'
import { READER_VIEW_TYPE, ReaderFeature } from './reader-feature'
import { ReaderView } from './reader-view'

const manifest = (id: string): ModuleManifest => ({
  id,
  name: `${id.toUpperCase()} Bible`,
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

// The navigation history is real runtime state the obsidian typings omit,
// modelled by the mock leaf so specs can drive the back and forward arrows.
type FakeLeaf = WorkspaceLeaf & {
  detached?: boolean
  canGoBack: boolean
  canGoForward: boolean
  back: () => Promise<void>
  forward: () => Promise<void>
}

type FakeNote = { content: string; ctime: number }

type HarnessOptions = { store?: ModuleStore }

const harness = (
  notes: Record<string, FakeNote> = {},
  options: HarnessOptions = {},
) => {
  const leaves: FakeLeaf[] = []
  let factory: ((leaf: WorkspaceLeaf) => unknown) | null = null
  const revealLeaf = vi.fn(async () => {})
  const commands: { id: string; callback: () => void }[] = []
  const ribbons: { icon: string; title: string; callback: () => void }[] = []
  const workspace = {
    getLeavesOfType: (type: string) =>
      type === READER_VIEW_TYPE ? leaves.filter((leaf) => !leaf.detached) : [],
    getLeaf: () => {
      const leaf = new WorkspaceLeaf() as unknown as FakeLeaf
      const applyViewState = leaf.setViewState.bind(leaf)
      leaf.setViewState = async (state) => {
        if (leaf.view !== null) return applyViewState(state)
        if (factory) leaf.view = factory(leaf) as WorkspaceLeaf['view']
        leaves.push(leaf)
      }
      return leaf
    },
    revealLeaf,
  }
  const vault = {
    getFileByPath: (path: string) =>
      notes[path] ? { path, stat: { ctime: notes[path].ctime } } : null,
    cachedRead: async (file: { path: string }) => notes[file.path].content,
  }
  const plugin = {
    app: { workspace, vault },
    registerView: (_type: string, viewFactory: (leaf: WorkspaceLeaf) => unknown) => {
      factory = viewFactory
    },
    addCommand: (command: { id: string; callback: () => void }) => {
      commands.push(command)
      return command
    },
    addRibbonIcon: (icon: string, title: string, callback: () => void) => {
      ribbons.push({ icon, title, callback })
      return document.createElement('div')
    },
  } as unknown as Plugin
  const index = new VaultReferenceIndex()
  const feature = new ReaderFeature(
    plugin,
    options.store ?? fakeStore(),
    index,
    { indexRefreshDebounceMs: 0 },
  )
  feature.useSettings({ ...DEFAULT_SETTINGS, defaultTranslationId: 'web' })
  return { feature, index, leaves, commands, ribbons, revealLeaf }
}

const ref = (text: string): Reference => {
  const parsed = parseReference(text, { translationIds: [] })
  if (parsed === null) throw new Error(`unparseable reference: ${text}`)
  return parsed.reference
}

const flushAsync = async (): Promise<void> => {
  await new Promise((resolve) => window.setTimeout(resolve, 0))
}

describe('ReaderFeature entry points', () => {
  it('registers the reader view and a command but no ribbon icon on load', async () => {
    const { feature, commands, ribbons } = harness()

    await feature.load()

    expect(commands.map((command) => command.id)).toEqual(['open-reader'])
    expect(ribbons).toHaveLength(0)
  })

  it('opens a reader leaf at the navigated reference', async () => {
    const { feature, leaves, revealLeaf } = harness()
    await feature.load()

    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()

    expect(leaves).toHaveLength(1)
    const view = leaves[0].view as ReaderView
    expect(view).toBeInstanceOf(ReaderView)
    expect(view.model.view.position).toEqual({ book: 43, chapter: 15 })
    expect(view.model.view.translations).toEqual([
      { id: 'web', label: 'WEB', name: 'WEB Bible', active: true },
    ])
    expect(view.model.view.banner).toBe('Opened at John 15:1')
    expect(revealLeaf).toHaveBeenCalled()
  })

  it('edits a cross-reference in a second reader leaf when asked for a new pane', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    const entry = {
      id: 'xr-vine',
      members: [ref('John 15:1'), ref('Genesis 1:1')],
      description: 'The vine',
    }

    feature.editCrossReference(entry, 'web')
    await flushAsync()
    feature.editCrossReference(entry, 'web', { newPane: true })
    await flushAsync()

    expect(leaves).toHaveLength(2)
    const second = (leaves[1].view as ReaderView).model
    expect(second.studyMaterial.collection?.editing).toBe(true)
    expect(second.studyMaterial.collection?.members).toHaveLength(2)
    expect(second.view.position).toEqual({ book: 43, chapter: 15 })
  })

  it('titles the reader tab with the chapter on screen', async () => {
    const { feature, leaves } = harness()
    await feature.load()

    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()

    expect((leaves[0].view as ReaderView).getDisplayText()).toBe('John 15')
  })

  it('refreshes the tab header when the chapter on screen changes', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    feature.openReference(ref('Genesis 1:1'), 'web')
    await flushAsync()
    const leaf = leaves[0]
    const updateHeader = vi.spyOn(
      leaf as unknown as { updateHeader: () => void },
      'updateHeader',
    )

    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()

    expect((leaf.view as ReaderView).getDisplayText()).toBe('John 15')
    expect(updateHeader).toHaveBeenCalled()
  })

  it('walks the chapters a pane has visited with its back and forward arrows', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const leaf = leaves[0]
    const view = leaf.view as ReaderView

    // The pane's first chapter starts its history rather than joining it.
    expect(leaf.canGoBack).toBe(false)
    await view.model.nextChapter()
    await flushAsync()
    expect(view.model.view.position).toEqual({ book: 43, chapter: 16 })

    await leaf.back()
    await flushAsync()
    expect(view.model.view.position).toEqual({ book: 43, chapter: 15 })
    expect(view.getDisplayText()).toBe('John 15')
    expect(leaf.canGoBack).toBe(false)

    await leaf.forward()
    await flushAsync()
    expect(view.model.view.position).toEqual({ book: 43, chapter: 16 })
    expect(view.getDisplayText()).toBe('John 16')
    // Replaying a recorded chapter never records it again.
    expect(leaf.canGoForward).toBe(false)
    expect(leaf.canGoBack).toBe(true)
  })

  it('records a reference opened into an already-open pane in its history', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    feature.openReference(ref('Genesis 1:1'), null)
    await flushAsync()
    const leaf = leaves[0]
    const view = leaf.view as ReaderView
    expect(view.model.view.banner).toBe('Opened at Genesis 1:1')

    await leaf.back()
    await flushAsync()

    expect(view.model.view.position).toEqual({ book: 43, chapter: 15 })
  })

  it('keeps selection, translation and toggle changes out of the pane history', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const leaf = leaves[0]
    const view = leaf.view as ReaderView

    await view.model.selectVerse(makeVerseId(43, 15, 1))
    await view.model.setTranslation('web')
    view.model.setToggle('redLetter', 'on')
    view.model.increaseFontScale()
    await flushAsync()

    expect(leaf.canGoBack).toBe(false)
  })

  it('gives each reader pane its own chapter history', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    feature.openReference(ref('Genesis 1:1'), null, { newPane: true })
    await flushAsync()
    const second = leaves[1].view as ReaderView

    await second.model.nextChapter()
    await flushAsync()

    expect(leaves[0].canGoBack).toBe(false)
    await leaves[1].back()
    await flushAsync()
    expect(second.model.view.position).toEqual({ book: 1, chapter: 1 })
    expect((leaves[0].view as ReaderView).model.view.position).toEqual({
      book: 43,
      chapter: 15,
    })
  })

  // A mod-clicked nav target: the pane asks its shell for a tab of its own
  // and stays where it stands (ticket #78).
  it('opens a nav target in a reader tab of its own', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const first = leaves[0].view as ReaderView

    await first.model.goTo(1, 1, { newTab: true })
    await flushAsync()

    expect(leaves).toHaveLength(2)
    expect((leaves[1].view as ReaderView).model.view.position).toEqual({
      book: 1,
      chapter: 1,
    })
    expect(first.model.view.position).toEqual({ book: 43, chapter: 15 })
    expect(leaves[0].canGoBack).toBe(false)
  })

  it('restores a saved chapter without recording it in the pane history', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const view = leaves[0].view as ReaderView
    const result = { history: true }

    await view.setState({ book: 43, chapter: 16 }, result)
    await flushAsync()

    expect(result.history).toBe(false)
    expect(view.model.view.position).toEqual({ book: 43, chapter: 16 })
  })

  it('opens a second reader leaf when the navigation asks for a new pane', async () => {
    const { feature, leaves } = harness()
    await feature.load()

    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    feature.openReference(ref('Genesis 1:1'), null, { newPane: true })
    await flushAsync()

    expect(leaves).toHaveLength(2)
    expect((leaves[0].view as ReaderView).model.view.position).toEqual({
      book: 43,
      chapter: 15,
    })
    expect((leaves[1].view as ReaderView).model.view.position).toEqual({
      book: 1,
      chapter: 1,
    })
  })

  it('reuses an already-open reader leaf for later navigations', async () => {
    const { feature, leaves } = harness()
    await feature.load()

    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    feature.openReference(ref('Genesis 1:1'), null)
    await flushAsync()

    expect(leaves).toHaveLength(1)
    const view = leaves[0].view as ReaderView
    expect(view.model.view.position).toEqual({ book: 1, chapter: 1 })
  })

  it('loads a deferred reader leaf before navigating it', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const leaf = leaves[0]
    const deferredView = leaf.view
    leaf.view = {} as WorkspaceLeaf['view']
    const loadIfDeferred = vi.fn(async () => {
      leaf.view = deferredView
    })
    leaf.loadIfDeferred = loadIfDeferred

    feature.openReference(ref('Genesis 1:1'), null)
    await flushAsync()

    expect(loadIfDeferred).toHaveBeenCalled()
    const view = leaf.view as ReaderView
    expect(view.model.view.position).toEqual({ book: 1, chapter: 1 })
  })

  it('opens the command entry point at the last position', async () => {
    const { feature, leaves, commands } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    leaves[0].detached = true

    commands[0].callback()
    await flushAsync()

    const reopened = leaves[1].view as ReaderView
    expect(reopened.model.view.position).toEqual({ book: 43, chapter: 15 })
    expect(reopened.model.view.banner).toBe(null)
  })

  it('serves annotation bodies from the vault to the chapter material', async () => {
    const { feature, index, leaves } = harness({
      'Annotations/John 15.1.md': {
        content: '---\nref: John 15:1\n---\nThe vine is Christ.\n',
        ctime: 42,
      },
    })
    await feature.load()
    index.indexNote(
      'Annotations/John 15.1.md',
      '---\nref: John 15:1\n---\nThe vine is Christ.\n',
    )
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const view = leaves[0].view as ReaderView

    expect(view.model.studyMaterial.chapterAnnotations).toEqual([
      {
        file: 'Annotations/John 15.1.md',
        label: 'John 15:1',
        body: 'The vine is Christ.\n',
      },
    ])
  })

  it('refreshes open reader panes when the index changes', async () => {
    const { feature, index, leaves } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const view = leaves[0].view as ReaderView
    expect(view.model.view.rows[0].mentions).toBe(0)

    index.indexNote('Sermons/Vine.md', '{John 15:1}')
    await flushAsync()

    expect(view.model.view.rows[0].mentions).toBe(1)
  })

  it('coalesces a burst of index notifications into one refresh', async () => {
    const { feature, index, leaves } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const view = leaves[0].view as ReaderView
    const refresh = vi.spyOn(view.model, 'refreshOccurrences')

    index.indexNote('Sermons/Vine.md', '{John 15:1}')
    index.indexNote('Sermons/Branches.md', '{John 15:2}')
    index.indexNote('Sermons/Fruit.md', '{John 15:5}')
    await flushAsync()

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(view.model.view.rows[0].mentions).toBe(1)
  })

  it('stops refreshing after unload even with a pending notification', async () => {
    const { feature, index, leaves } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const view = leaves[0].view as ReaderView
    const refresh = vi.spyOn(view.model, 'refreshOccurrences')

    index.indexNote('Sermons/Vine.md', '{John 15:1}')
    feature.unload()
    await flushAsync()

    expect(refresh).not.toHaveBeenCalled()
  })

  it('applies a changed annotation ordering to already-open panes', async () => {
    const notes: Record<string, FakeNote> = {
      'Annotations/Zeal.md': {
        content: '---\nref: John 15:1\n---\nolder\n',
        ctime: 1,
      },
      'Annotations/Abide.md': {
        content: '---\nref: John 15:1\n---\nnewer\n',
        ctime: 2,
      },
    }
    const { feature, index, leaves } = harness(notes)
    await feature.load()
    index.indexNote('Annotations/Zeal.md', notes['Annotations/Zeal.md'].content)
    index.indexNote(
      'Annotations/Abide.md',
      notes['Annotations/Abide.md'].content,
    )
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const view = leaves[0].view as ReaderView

    feature.useSettings({
      ...DEFAULT_SETTINGS,
      defaultTranslationId: 'web',
      annotationOrdering: 'path-a-z',
    })
    feature.onSettingsChanged()
    await flushAsync()

    expect(
      view.model.studyMaterial.chapterAnnotations.map((item) => item.file),
    ).toEqual(['Annotations/Abide.md', 'Annotations/Zeal.md'])
  })

  it('reloads a no-translation pane when a module install lands in settings', async () => {
    let installed: ModuleManifest[] = []
    const store = {
      installedManifests: async () => installed,
      manifest: async (moduleId: string) =>
        installed.find((entry) => entry.id === moduleId) ?? null,
      bookContent: async (moduleId: string, book: number) =>
        moduleId === 'web' && book === 43
          ? { [makeVerseId(43, 15, 1)]: 'I am the true vine.' }
          : {},
    } as unknown as ModuleStore
    const { feature, leaves } = harness({}, { store })
    feature.useSettings({ ...DEFAULT_SETTINGS })
    await feature.load()
    feature.openReference(ref('John 15:1'), null)
    await flushAsync()
    const view = leaves[0].view as ReaderView
    expect(view.model.view.status).toBe('no-translation')

    installed = [manifest('web')]
    feature.useSettings({
      ...DEFAULT_SETTINGS,
      installedModuleIds: ['web'],
      defaultTranslationId: 'web',
    })
    feature.onSettingsChanged()
    await flushAsync()

    expect(view.model.view.status).toBe('ok')
    expect(view.model.view.translations.map((pill) => pill.id)).toEqual(['web'])
  })

  it('renders cue-marked verses red in reader panes when derived red letter is on', async () => {
    const { feature, leaves } = harness()
    feature.useSettings({
      ...DEFAULT_SETTINGS,
      defaultTranslationId: 'web',
      derivedRedLetter: true,
    })
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()

    const view = leaves[0].view as ReaderView
    expect(view.model.view.rows[0].segments).toEqual([
      { text: 'I am the true vine.', redLetter: true },
    ])
  })

  it('follows a global red-letter flip in panes the user never toggled', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const view = leaves[0].view as ReaderView
    expect(view.model.view.toggles.redLetter).toBe('off')

    feature.useSettings({
      ...DEFAULT_SETTINGS,
      defaultTranslationId: 'web',
      derivedRedLetter: true,
    })
    feature.onSettingsChanged()
    await flushAsync()

    expect(view.model.view.toggles.redLetter).toBe('on')
    expect(view.model.view.rows[0].segments[0].redLetter).toBe(true)
  })

  it('keeps a user-toggled pane on its own choice when the global setting flips', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const view = leaves[0].view as ReaderView
    view.model.setToggle('redLetter', 'on')
    await flushAsync()

    feature.useSettings({
      ...DEFAULT_SETTINGS,
      defaultTranslationId: 'web',
      derivedRedLetter: true,
    })
    feature.onSettingsChanged()
    await flushAsync()
    feature.useSettings({ ...DEFAULT_SETTINGS, defaultTranslationId: 'web' })
    feature.onSettingsChanged()
    await flushAsync()

    expect(view.model.view.toggles.redLetter).toBe('on')
    expect(view.model.view.rows[0].segments[0].redLetter).toBe(true)
  })

  it('turns derived red on for one pane while the global setting is off', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const view = leaves[0].view as ReaderView
    expect(view.model.view.rows[0].segments[0].redLetter).toBe(false)

    view.model.setToggle('redLetter', 'on')
    await flushAsync()

    expect(view.model.view.rows[0].segments[0].redLetter).toBe(true)
  })

  it('turns derived red off for one pane while the global setting is on', async () => {
    const { feature, leaves } = harness()
    feature.useSettings({
      ...DEFAULT_SETTINGS,
      defaultTranslationId: 'web',
      derivedRedLetter: true,
    })
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const view = leaves[0].view as ReaderView
    expect(view.model.view.toggles.redLetter).toBe('on')
    expect(view.model.view.rows[0].segments[0].redLetter).toBe(true)

    view.model.setToggle('redLetter', 'off')
    await flushAsync()

    expect(view.model.view.rows[0].segments[0].redLetter).toBe(false)
  })

  it('leaves native red spans alone when the pane toggle flips', async () => {
    const nativeRedManifest = {
      ...manifest('web'),
      capabilities: { strongsTagged: false, redLetter: true },
    }
    const store = {
      installedManifests: async () => [nativeRedManifest],
      manifest: async (moduleId: string) =>
        moduleId === 'web' ? nativeRedManifest : null,
      bookContent: async (moduleId: string, book: number) =>
        moduleId === 'web' && book === 43
          ? {
              [makeVerseId(43, 15, 1)]: {
                text: 'I am the true vine.',
                red: [{ start: 0, end: 4 }],
              },
            }
          : {},
    } as unknown as ModuleStore
    const { feature, leaves } = harness({}, { store })
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const view = leaves[0].view as ReaderView
    const nativeSegments = [
      { text: 'I am', redLetter: true },
      { text: ' the true vine.', redLetter: false },
    ]
    expect(view.model.view.rows[0].segments).toEqual(nativeSegments)

    view.model.setToggle('redLetter', 'on')
    await flushAsync()
    expect(view.model.view.rows[0].segments).toEqual(nativeSegments)

    view.model.setToggle('redLetter', 'off')
    await flushAsync()
    expect(view.model.view.rows[0].segments).toEqual(nativeSegments)
  })

  it('omits the red-letter toggle from view state until the user overrides it', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const view = leaves[0].view as ReaderView

    expect(view.getState()).toEqual({ book: 43, chapter: 15 })
  })

  it('round-trips the red-letter toggle through the pane view state', async () => {
    const { feature, leaves, commands } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const view = leaves[0].view as ReaderView
    view.model.setToggle('redLetter', 'on')
    await flushAsync()
    expect(view.getState()).toEqual({
      book: 43,
      chapter: 15,
      redLetter: 'on',
    })

    leaves[0].detached = true
    commands[0].callback()
    await flushAsync()
    const reopened = leaves[1].view as ReaderView
    await reopened.setState(
      { book: 43, chapter: 15, redLetter: 'on' },
      { history: false },
    )
    await flushAsync()

    expect(reopened.model.view.toggles.redLetter).toBe('on')
    expect(reopened.model.view.rows[0].segments[0].redLetter).toBe(true)
  })

  it('passes the annotation ordering setting to new panes', async () => {
    const { feature, index, leaves } = harness({
      'Annotations/Zeal.md': {
        content: '---\nref: John 15:1\n---\nolder\n',
        ctime: 1,
      },
      'Annotations/Abide.md': {
        content: '---\nref: John 15:1\n---\nnewer\n',
        ctime: 2,
      },
    })
    feature.useSettings({
      ...DEFAULT_SETTINGS,
      defaultTranslationId: 'web',
      annotationOrdering: 'path-a-z',
    })
    await feature.load()
    index.indexNote('Annotations/Zeal.md', '---\nref: John 15:1\n---\nolder\n')
    index.indexNote('Annotations/Abide.md', '---\nref: John 15:1\n---\nnewer\n')
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const view = leaves[0].view as ReaderView

    expect(
      view.model.studyMaterial.chapterAnnotations.map((item) => item.file),
    ).toEqual(['Annotations/Abide.md', 'Annotations/Zeal.md'])
  })

  it('prefills annotation refs from the reader verse selection', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    const view = leaves[0].view as ReaderView

    await view.model.selectVerse(makeVerseId(43, 15, 4))

    expect(feature.prefillReference()).toEqual(ref('John 15:4'))
  })

  it('prefills the current chapter when no verse is selected', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()
    expect(leaves).toHaveLength(1)

    expect(feature.prefillReference()).toEqual(ref('John 15'))
  })

  it('prefills nothing when no reader pane is open', async () => {
    const { feature } = harness()
    await feature.load()

    expect(feature.prefillReference()).toBe(null)
  })

  it('seeds new panes with the desktop reader toggle defaults from settings', async () => {
    const { feature, leaves } = harness()
    feature.useSettings({
      ...DEFAULT_SETTINGS,
      defaultTranslationId: 'web',
      readerNavDefault: { desktop: 'breadcrumb', mobile: 'tree' },
      readerLayoutDefault: { desktop: 'continuous', mobile: 'verse-per-line' },
      readerStrongsDefault: { desktop: 'on', mobile: 'off' },
      readerParaNumbersDefault: { desktop: 'on', mobile: 'hover' },
      derivedRedLetter: true,
    })
    await feature.load()

    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()

    const view = leaves[0].view as ReaderView
    expect(view.model.view.toggles).toEqual({
      nav: 'breadcrumb',
      layout: 'continuous',
      strongs: 'on',
      redLetter: 'on',
      paraNumbers: 'on',
    })
  })

  it('seeds new panes with the mobile reader toggle defaults on a mobile device', async () => {
    const { feature, leaves } = harness()
    feature.useSettings({
      ...DEFAULT_SETTINGS,
      defaultTranslationId: 'web',
      readerNavDefault: { desktop: 'breadcrumb', mobile: 'tree' },
      readerLayoutDefault: { desktop: 'continuous', mobile: 'verse-per-line' },
      readerStrongsDefault: { desktop: 'on', mobile: 'off' },
      readerParaNumbersDefault: { desktop: 'on', mobile: 'hover' },
    })
    Platform.isMobile = true
    try {
      await feature.load()

      feature.openReference(ref('John 15:1'), 'web')
      await flushAsync()

      const view = leaves[0].view as ReaderView
      expect(view.model.view.toggles).toEqual(
        expect.objectContaining({
          nav: 'tree',
          layout: 'verse-per-line',
          strongs: 'off',
          paraNumbers: 'hover',
        }),
      )
    } finally {
      Platform.isMobile = false
    }
  })
})

describe('ReaderFeature translation listing', () => {
  it('keeps the dictionaries module out of the translation pills', async () => {
    const store = {
      installedManifests: async () => [
        manifest('web'),
        {
          ...manifest('strongs-dictionaries'),
          kind: 'strongs-dictionaries' as const,
        },
      ],
      manifest: async (moduleId: string) =>
        moduleId === 'web' ? manifest('web') : null,
      bookContent: async (moduleId: string, book: number) =>
        moduleId === 'web' && book === 43
          ? { [makeVerseId(43, 15, 1)]: 'I am the true vine.' }
          : {},
    } as unknown as ModuleStore
    const { feature, leaves } = harness({}, { store })
    await feature.load()

    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()

    const view = leaves[0].view as ReaderView
    expect(view.model.view.translations.map((pill) => pill.id)).toEqual([
      'web',
    ])
  })
})

describe('ReaderFeature available translations', () => {
  it('lists only installed modules, ignoring legacy online-tier settings', async () => {
    const { feature, leaves } = harness()
    feature.useSettings(
      Object.assign({ ...DEFAULT_SETTINGS, defaultTranslationId: 'web' }, {
        apiBibleKey: 'key',
        enabledOnlineTranslationIds: ['nkjv'],
      }),
    )
    await feature.load()

    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()

    const view = leaves[0].view as ReaderView
    expect(view.model.view.translations.map((pill) => pill.id)).toEqual([
      'web',
    ])
  })
})

describe('ReaderFeature study material', () => {
  it('resolves a reader tab to the study material of its pane', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()

    const source = feature.studyMaterialFor(leaves[0].view)

    expect(source).not.toBe(null)
    source?.startCollecting()
    expect(source?.studyMaterial.collection?.members).toEqual([])
    expect(
      (leaves[0].view as ReaderView).model.studyMaterial.collection,
    ).not.toBe(null)
  })

  it('resolves anything that is not a reader tab to no study material', async () => {
    const { feature } = harness()
    await feature.load()

    expect(feature.studyMaterialFor(null)).toBe(null)
    const markdownView = { getViewType: () => 'markdown' } as unknown as View
    expect(feature.studyMaterialFor(markdownView)).toBe(null)
  })
})

const HUMILITY = 101

const HUMILITY_SECTIONS = [
  { chapter: 0, name: 'Preface', paragraphs: 2 },
  { chapter: 1, name: 'The Glory of the Creature', paragraphs: 3 },
]

const humilityManifest = (): ModuleManifest => ({
  ...manifest('hum-m1895'),
  name: 'Humility',
  kind: 'book',
  book: {
    number: HUMILITY,
    editionCode: 'HUM-M1895',
    author: 'Andrew Murray',
    year: 1895,
    abbreviation: 'Hum',
    sections: HUMILITY_SECTIONS,
  },
})

const bookStore = (): ModuleStore =>
  ({
    installedManifests: async () => [manifest('web'), humilityManifest()],
    manifest: async (moduleId: string) =>
      moduleId === 'web'
        ? manifest('web')
        : moduleId === 'hum-m1895'
          ? humilityManifest()
          : null,
    bookContent: async (moduleId: string, book: number) =>
      moduleId === 'hum-m1895' && book === HUMILITY
        ? {
            [makeVerseId(HUMILITY, 1, 1)]: 'When God created the universe.',
            [makeVerseId(HUMILITY, 1, 2)]: 'And so pride is the root.',
          }
        : moduleId === 'web' && book === 43
          ? { [makeVerseId(43, 15, 1)]: 'I am the true vine.' }
          : {},
    epigraphs: async (moduleId: string) =>
      moduleId === 'hum-m1895'
        ? { 1: [{ quote: 'Cast their crowns.', attribution: 'Rev. iv. 11' }] }
        : {},
  }) as unknown as ModuleStore

const bookReference = (chapter: number, paragraph: number): Reference => ({
  book: HUMILITY,
  ranges: [
    {
      startId: makeVerseId(HUMILITY, chapter, paragraph),
      endId: makeVerseId(HUMILITY, chapter, paragraph),
    },
  ],
})

describe('ReaderFeature book mode', () => {
  // Registered exactly as plugin load does it, so the pane sees the book the
  // grammar and the citations see.
  beforeEach(() => registerManifestBook(humilityManifest()))

  afterEach(() => deregisterManifestBook(humilityManifest()))

  // The seam a book chip's navigation uses is the shared ReferenceNavigator —
  // the same one scripture chips already travel (ticket #72 supplies the chip).
  it('opens the reader at a book paragraph with highlight and entry banner', async () => {
    const { feature, leaves } = harness({}, { store: bookStore() })
    await feature.load()

    feature.openReference(bookReference(1, 2), null)
    await flushAsync()

    const view = (leaves[0].view as ReaderView).model.view
    expect(view.position).toEqual({ book: HUMILITY, chapter: 1 })
    expect(view.book?.sectionName).toBe('The Glory of the Creature')
    expect(view.book?.edition).toBe('Humility 1895')
    expect(view.book?.epigraphs).toEqual([
      {
        quote: 'Cast their crowns.',
        attribution: [{ text: 'Rev. iv. 11', redLetter: false }],
      },
    ])
    expect(
      view.rows.filter((row) => row.highlighted).map((row) => row.label),
    ).toEqual(['2'])
    expect(view.banner).toBe('Opened at Humility ch. 1, par. 2')
  })

  // What the ribbon panel's Books section renders and activates (ticket #78).
  it('lists the installed books for the ribbon menu', async () => {
    const { feature } = harness({}, { store: bookStore() })
    await feature.load()

    expect((await feature.installedBooks()).map((book) => book.title)).toEqual([
      'Humility',
    ])
  })

  it('opens a book at its first section in the reader already open', async () => {
    const { feature, leaves } = harness({}, { store: bookStore() })
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()

    await feature.openBook(HUMILITY)
    await flushAsync()

    expect(leaves).toHaveLength(1)
    expect((leaves[0].view as ReaderView).model.view.position).toEqual({
      book: HUMILITY,
      chapter: 0,
    })
  })

  it('opens a book at the last position the reader held inside it', async () => {
    const { feature, leaves } = harness({}, { store: bookStore() })
    await feature.load()
    feature.openReference(bookReference(1, 1), null)
    await flushAsync()

    await feature.openBook(HUMILITY)
    await flushAsync()

    expect((leaves[0].view as ReaderView).model.view.position).toEqual({
      book: HUMILITY,
      chapter: 1,
    })
  })

  it('opens a book in a reader tab of its own when asked', async () => {
    const { feature, leaves } = harness({}, { store: bookStore() })
    await feature.load()
    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()

    await feature.openBook(HUMILITY, { newTab: true })
    await flushAsync()

    expect(leaves).toHaveLength(2)
    expect((leaves[1].view as ReaderView).model.view.position).toEqual({
      book: HUMILITY,
      chapter: 0,
    })
    expect((leaves[0].view as ReaderView).model.view.position).toEqual({
      book: 43,
      chapter: 15,
    })
  })

  it('reopens the command entry point at the last book position', async () => {
    const { feature, leaves, commands } = harness({}, { store: bookStore() })
    await feature.load()
    feature.openReference(bookReference(1, 1), null)
    await flushAsync()
    leaves[0].detached = true

    commands[0].callback()
    await flushAsync()

    const reopened = leaves[1].view as ReaderView
    expect(reopened.model.view.position).toEqual({
      book: HUMILITY,
      chapter: 1,
    })
    expect(reopened.model.view.banner).toBe(null)
  })
})
