import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceLeaf, type Plugin } from 'obsidian'
import { FakeSearchIndexSource } from '../../tests/fixtures/fake-search-index-source'
import {
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import type { NavigationOptions, ReferenceNavigator } from '../contracts'
import {
  DEFAULT_SETTINGS,
  SettingsStore,
  type ScriptureStudySettings,
} from '../data-access'
import type { ModuleStore } from '../modules'
import { makeVerseId, type Reference } from '../reference'
import { SEARCH_PANE_VIEW_TYPE, SearchFeature } from './search-feature'
import { SearchPaneView } from './search-pane-view'

type FakeLeaf = WorkspaceLeaf & { detached?: boolean }

type FakeCommand = { id: string; name: string; callback: () => void }

const fakeStore = (): FakeSearchIndexSource =>
  new FakeSearchIndexSource(
    {
      web: { 43: { [makeVerseId(43, 15, 1)]: 'I am the true vine.' } },
      kjv: { 43: { [makeVerseId(43, 15, 1)]: 'I am the true vine.' } },
      'hum-m1895': {
        101: { [makeVerseId(101, 1, 2)]: 'Humility is the soil of every grace.' },
      },
    },
    undefined,
    { 'hum-m1895': 101 },
  )

const harness = (settings: Partial<ScriptureStudySettings> = {}) => {
  const leaves: FakeLeaf[] = []
  let factory: ((leaf: WorkspaceLeaf) => unknown) | null = null
  let registeredType: string | null = null
  const revealLeaf = vi.fn(async () => {})
  const commands: FakeCommand[] = []
  const workspaceEvents: string[] = []
  const makeLeaf = (): FakeLeaf => {
    const leaf = new WorkspaceLeaf() as FakeLeaf
    leaf.setViewState = async () => {
      if (factory) leaf.view = factory(leaf) as WorkspaceLeaf['view']
      leaves.push(leaf)
    }
    return leaf
  }
  const workspace = {
    on: (name: string) => {
      workspaceEvents.push(name)
      return { name }
    },
    getLeavesOfType: (type: string) =>
      type === SEARCH_PANE_VIEW_TYPE
        ? leaves.filter((leaf) => !leaf.detached)
        : [],
    getRightLeaf: vi.fn(() => makeLeaf()),
    revealLeaf,
  }
  const plugin = {
    app: { workspace },
    registerView: (type: string, viewFactory: (leaf: WorkspaceLeaf) => unknown) => {
      registeredType = type
      factory = viewFactory
    },
    addCommand: (command: FakeCommand) => {
      commands.push(command)
      return command
    },
    registerEvent: () => {},
  } as unknown as Plugin
  const opened: {
    reference: Reference
    translationId: string | null
    options: NavigationOptions | undefined
  }[] = []
  const navigator: ReferenceNavigator = {
    openReference: (reference, translationId, options) => {
      opened.push({ reference, translationId, options })
    },
    openNote: () => {},
    editCrossReference: () => {},
  }
  const stored: ScriptureStudySettings = {
    ...DEFAULT_SETTINGS,
    installedModuleIds: ['web'],
    fallbackTranslationId: 'web',
    ...settings,
  }
  let saved: ScriptureStudySettings = stored
  const settingsStore = new SettingsStore({
    loadData: async () => saved,
    saveData: async (data: unknown) => {
      saved = data as ScriptureStudySettings
    },
  })
  const store = fakeStore()
  const feature = new SearchFeature(
    plugin,
    store as unknown as ModuleStore,
    settingsStore,
  )
  feature.useNavigator(navigator)
  feature.useSettings(stored)
  return {
    feature,
    store,
    leaves,
    commands,
    revealLeaf,
    workspace,
    opened,
    workspaceEvents,
    settingsStore,
    saved: () => saved,
    viewType: () => registeredType,
  }
}

describe('SearchFeature', () => {
  it('registers its own view type and an open command', async () => {
    const { feature, commands, viewType } = harness()
    await feature.load()
    expect(viewType()).toBe(SEARCH_PANE_VIEW_TYPE)
    expect(commands.map((command) => command.id)).toEqual(['open-search'])
  })

  it('opens the pane in the right sidebar', async () => {
    const { feature, leaves, revealLeaf, workspace } = harness()
    await feature.load()
    await feature.openPane()
    expect(workspace.getRightLeaf).toHaveBeenCalledTimes(1)
    expect(leaves).toHaveLength(1)
    expect(revealLeaf).toHaveBeenCalledTimes(1)
  })

  it('reveals the one pane rather than opening a second', async () => {
    const { feature, leaves, revealLeaf } = harness()
    await feature.load()
    await feature.openPane()
    await feature.openPane()
    await feature.openPane()
    expect(leaves).toHaveLength(1)
    expect(revealLeaf).toHaveBeenCalledTimes(3)
  })

  it('never follows the focused tab', async () => {
    const { feature, workspaceEvents } = harness()
    await feature.load()
    expect(workspaceEvents).toEqual([])
  })

  it('searches the fallback translation', async () => {
    const { feature } = harness()
    const model = feature.createModel()
    expect(model.view.translationLabel).toBe('WEB')
    model.setQuery('vine')
    await model.submit()
    expect(model.view.books.map((group) => group.name)).toEqual(['John'])
  })

  it('has nothing to search without an installed module', async () => {
    const { feature } = harness({
      installedModuleIds: [],
      fallbackTranslationId: null,
    })
    const model = feature.createModel()
    model.setQuery('vine')
    await model.submit()
    expect(model.view.status).toBe('no-translation')
  })

  it('opens an activated hit in the reader, in the searched translation', async () => {
    const { feature, opened } = harness()
    const model = feature.createModel()
    model.setQuery('vine')
    await model.submit()
    model.openHit(model.view.books[0].hits[0], { newPane: true })
    expect(opened).toEqual([
      {
        reference: {
          book: 43,
          ranges: [
            { startId: makeVerseId(43, 15, 1), endId: makeVerseId(43, 15, 1) },
          ],
        },
        translationId: 'web',
        options: {
          newPane: true,
          emphasis: [
            { verseId: makeVerseId(43, 15, 1), start: 14, end: 18 },
          ],
        },
      },
    ])
  })

  it('re-reads the searchable module when settings change', async () => {
    const { feature } = harness()
    const model = feature.createModel()
    expect(model.view.translationLabel).toBe('WEB')
    feature.useSettings({
      ...DEFAULT_SETTINGS,
      installedModuleIds: ['kjv'],
      fallbackTranslationId: 'kjv',
    })
    feature.onSettingsChanged()
    expect(model.view.translationLabel).toBe('KJV')
  })

  it('stops refreshing a pane once it is released', () => {
    const { feature } = harness()
    const model = feature.createModel()
    let notifications = 0
    model.subscribe(() => {
      notifications += 1
    })
    feature.onSettingsChanged()
    expect(notifications).toBe(1)
    feature.releaseModel(model)
    feature.onSettingsChanged()
    expect(notifications).toBe(1)
  })

  it('gives the opened pane a model of its own', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    await feature.openPane()
    const view = leaves[0].view as unknown as SearchPaneView
    expect(view).toBeInstanceOf(SearchPaneView)
    expect(view.getViewType()).toBe(SEARCH_PANE_VIEW_TYPE)
    view.model.setQuery('vine')
    await view.model.submit()
    expect(view.model.view.totalHits).toBe(1)
  })
})

describe('SearchFeature scope', () => {
  beforeEach(installHumilityBook)
  afterEach(uninstallHumilityBook)

  const installed = { installedModuleIds: ['web', 'kjv', 'hum-m1895'] }

  it('offers the installed translations and books, and starts on every one', () => {
    const { feature } = harness(installed)
    const { scope } = feature.createModel().view
    expect(scope.translations).toEqual([
      { id: 'web', label: 'WEB' },
      { id: 'kjv', label: 'KJV' },
    ])
    expect(scope.translationId).toBe('web')
    expect(scope.testament).toBe('all')
    expect(scope.books).toEqual([
      { moduleId: 'hum-m1895', bookId: 101, label: 'Humility', selected: true },
    ])
  })

  it('writes every scope choice to this device’s settings', async () => {
    const { feature, saved } = harness(installed)
    const model = feature.createModel()
    model.chooseTranslation('kjv')
    model.chooseTestament('nt')
    model.toggleBook('hum-m1895')
    await vi.waitFor(() =>
      expect(saved().searchScope.desktop).toEqual({
        translationId: 'kjv',
        testament: 'nt',
        excludedBookIds: ['hum-m1895'],
      }),
    )
  })

  it('reopens on the scope it was left in, with no query or results', async () => {
    const { feature, saved } = harness(installed)
    const model = feature.createModel()
    model.chooseTranslation('kjv')
    model.chooseTestament('ot')
    model.setQuery('vine')
    await model.submit()
    await vi.waitFor(() =>
      expect(saved().searchScope.desktop.translationId).toBe('kjv'),
    )

    const reloaded = harness().feature
    reloaded.useSettings(saved())
    const reopened = reloaded.createModel()
    expect(reopened.view.scope.translationId).toBe('kjv')
    expect(reopened.view.scope.testament).toBe('ot')
    expect(reopened.view.query).toBe('')
    expect(reopened.view.submittedQuery).toBeNull()
    expect(reopened.view.books).toEqual([])
  })

  it('falls back to the Fallback Translation when the remembered one is gone', () => {
    const { feature } = harness({
      ...installed,
      installedModuleIds: ['web', 'hum-m1895'],
      searchScope: {
        ...DEFAULT_SETTINGS.searchScope,
        desktop: {
          translationId: 'kjv',
          testament: 'all',
          excludedBookIds: [],
        },
      },
    })
    const model = feature.createModel()
    expect(model.view.scope.translationId).toBe('web')
    expect(model.view.translationLabel).toBe('WEB')
  })

  it('searches the scope’s book alongside its translation', async () => {
    const { feature } = harness(installed)
    const model = feature.createModel()
    model.setQuery('humility')
    await model.submit()
    expect(model.view.books.map((group) => group.name)).toEqual(['Humility'])
  })
})

describe('SearchFeature eager indexing', () => {
  it('builds a module’s index when its install asks for one', async () => {
    const { feature, store } = harness()

    await feature.indexModule('kjv')

    expect(store.indexWrites).toEqual(['kjv'])
  })

  it('leaves the pane nothing to index on its first search', async () => {
    const { feature, store } = harness()
    await feature.indexModule('web')
    store.forget()
    const model = feature.createModel()

    model.setQuery('vine')
    await model.submit()

    expect(model.view.totalHits).toBe(1)
    expect(model.view.indexing).toBeNull()
    // Only the book the hit sits in is read, and only for its text.
    expect(store.contentReads).toEqual(['web/43'])
  })
})
