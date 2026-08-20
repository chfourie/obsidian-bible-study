import { describe, expect, it, vi } from 'vitest'
import { WorkspaceLeaf, type Plugin } from 'obsidian'
import type { NavigationOptions, ReferenceNavigator } from '../contracts'
import { DEFAULT_SETTINGS, type ScriptureStudySettings } from '../data-access'
import type { ModuleStore } from '../modules'
import { makeVerseId, type Reference } from '../reference'
import { SEARCH_PANE_VIEW_TYPE, SearchFeature } from './search-feature'
import { SearchPaneView } from './search-pane-view'

type FakeLeaf = WorkspaceLeaf & { detached?: boolean }

type FakeCommand = { id: string; name: string; callback: () => void }

const fakeStore = (): ModuleStore =>
  ({
    bookContent: async (moduleId: string, book: number) =>
      moduleId === 'web' && book === 43
        ? { [makeVerseId(43, 15, 1)]: 'I am the true vine.' }
        : null,
  }) as unknown as ModuleStore

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
  const feature = new SearchFeature(plugin, fakeStore())
  feature.useNavigator(navigator)
  feature.useSettings({
    ...DEFAULT_SETTINGS,
    installedModuleIds: ['web'],
    fallbackTranslationId: 'web',
    ...settings,
  })
  return {
    feature,
    leaves,
    commands,
    revealLeaf,
    workspace,
    opened,
    workspaceEvents,
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
        options: { newPane: true },
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
