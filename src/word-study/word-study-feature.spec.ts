import { describe, expect, it, vi } from 'vitest'
import { WorkspaceLeaf, type Plugin } from 'obsidian'
import type { StrongsEntryView } from '../contracts'
import { DEFAULT_SETTINGS } from '../data-access'
import { WordStudyFeature } from './word-study-feature'
import type { WordStudyDictionary, WordStudyEntry } from './word-study-model'
import { WORD_STUDY_VIEW_TYPE, WordStudyView } from './word-study-view'

const entryView = (strongs: string): StrongsEntryView => ({
  strongs,
  variant: strongs,
  lemma: 'ἀγάπη',
  transliteration: 'agapē',
  morphology: 'G:N-F',
  gloss: 'love',
  definition: 'love, affection, benevolence',
})

const entry = (strongs: string): WordStudyEntry => ({
  entry: entryView(strongs),
  siblings: strongs === 'H0001G' ? ['H0001H'] : [],
  derivation: strongs === 'H0001G' ? 'from H3050;' : null,
})

const fakeDictionary = (
  numbers: string[] = ['G0026', 'G0025'],
): WordStudyDictionary => ({
  installed: async () => true,
  entryFor: async (number) => (numbers.includes(number) ? entry(number) : null),
  install: async () => {},
  attribution: 'Dictionary data: TBESH/TBESG (CC BY 4.0)',
  etymologyAttribution: "Etymology: Strong's (1890, public domain)",
})

type FakeLeaf = WorkspaceLeaf & { detached?: boolean }

// A null dictionary stands for a feature wired up without one at all.
type HarnessOptions = { dictionary?: WordStudyDictionary | null }

const harness = (options: HarnessOptions = {}) => {
  const leaves: FakeLeaf[] = []
  let factory: ((leaf: WorkspaceLeaf) => unknown) | null = null
  const revealLeaf = vi.fn(async () => {})
  const commands: { id: string; name: string; callback: () => void }[] = []
  const handlers: Record<string, ((...args: never[]) => void)[]> = {}
  const on = (name: string, callback: (...args: never[]) => void) => {
    handlers[name] = [...(handlers[name] ?? []), callback]
    return { name }
  }
  // A leaf that builds its view the first time it is given one, then applies
  // every state through it — the runtime's own setViewState, which the mock
  // leaf cannot do without a view registry.
  const makeLeaf = (): FakeLeaf => {
    const leaf = new WorkspaceLeaf() as FakeLeaf
    const applyViewState = leaf.setViewState.bind(leaf)
    leaf.setViewState = async (state) => {
      if (leaf.view === null) {
        if (factory === null) return
        leaf.view = factory(leaf) as WorkspaceLeaf['view']
        leaves.push(leaf)
      }
      return applyViewState(state)
    }
    return leaf
  }
  const workspace = {
    on,
    getLeavesOfType: (type: string) =>
      type === WORD_STUDY_VIEW_TYPE
        ? leaves.filter((leaf) => leaf.detached !== true)
        : [],
    getLeaf: () => makeLeaf(),
    revealLeaf,
  }
  const plugin = {
    app: { workspace },
    registerView: (
      _type: string,
      viewFactory: (leaf: WorkspaceLeaf) => unknown,
    ) => {
      factory = viewFactory
    },
    addCommand: (command: { id: string; name: string; callback: () => void }) => {
      commands.push(command)
      return command
    },
    registerEvent: () => {},
  } as unknown as Plugin
  const dictionary =
    options.dictionary === undefined ? fakeDictionary() : options.dictionary
  const feature =
    dictionary === null
      ? new WordStudyFeature(plugin)
      : new WordStudyFeature(plugin, { dictionary })
  feature.useSettings(DEFAULT_SETTINGS)
  const focus = (leaf: WorkspaceLeaf | null) => {
    handlers['active-leaf-change']?.forEach((handler) =>
      (handler as (leaf: WorkspaceLeaf | null) => void)(leaf),
    )
  }
  // A tab Obsidian rebuilds from the saved layout: the view is constructed
  // and handed the state it was left with.
  const restore = async (state: Record<string, unknown>) => {
    const leaf = makeLeaf()
    await leaf.setViewState({ type: WORD_STUDY_VIEW_TYPE, state })
    return leaf
  }
  const close = async (leaf: FakeLeaf) => {
    leaf.detached = true
    await (leaf.view as WordStudyView).onClose()
  }
  return { feature, leaves, commands, revealLeaf, focus, restore, close }
}

const panel = (leaf: WorkspaceLeaf): WordStudyView => {
  const view = leaf.view
  if (!(view instanceof WordStudyView)) throw new Error('not a word study panel')
  return view
}

describe('WordStudyFeature', () => {
  it('opens a Word Study Panel on the number it is asked for', async () => {
    const { feature, leaves, revealLeaf } = harness()
    await feature.load()
    await feature.openWordStudy('G0026')
    expect(leaves).toHaveLength(1)
    expect(panel(leaves[0]).model.view).toMatchObject({
      number: 'G0026',
      status: 'ok',
      entry: { strongs: 'G0026', lemma: 'ἀγάπη', gloss: 'love' },
    })
    expect(revealLeaf).toHaveBeenCalled()
  })

  it('names the tab after the number under study', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    await feature.openWordStudy('G0026')
    expect(panel(leaves[0]).getDisplayText()).toBe('G0026')
  })

  it('retargets the open panel when the number is activated plainly', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    await feature.openWordStudy('G0026')
    await feature.openWordStudy('G0025')
    expect(leaves).toHaveLength(1)
    expect(panel(leaves[0]).model.view.number).toBe('G0025')
  })

  it('spawns a second panel when a new pane is asked for', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    await feature.openWordStudy('G0026')
    await feature.openWordStudy('G0025', { newPane: true })
    expect(leaves).toHaveLength(2)
    expect(panel(leaves[0]).model.view.number).toBe('G0026')
    expect(panel(leaves[1]).model.view.number).toBe('G0025')
  })

  it('retargets the most-recently-focused panel, not the first one opened', async () => {
    const { feature, leaves, focus } = harness({
      dictionary: fakeDictionary(['G0026', 'G0025', 'H0157']),
    })
    await feature.load()
    await feature.openWordStudy('G0026')
    await feature.openWordStudy('G0025', { newPane: true })
    focus(leaves[0])
    await feature.openWordStudy('H0157')
    expect(leaves).toHaveLength(2)
    expect(panel(leaves[0]).model.view.number).toBe('H0157')
    expect(panel(leaves[1]).model.view.number).toBe('G0025')
  })

  it('ignores focus landing on a tab that is not a word study', async () => {
    const { feature, leaves, focus } = harness()
    await feature.load()
    await feature.openWordStudy('G0026')
    focus({ view: {} } as unknown as WorkspaceLeaf)
    focus(null)
    await feature.openWordStudy('G0025')
    expect(leaves).toHaveLength(1)
    expect(panel(leaves[0]).model.view.number).toBe('G0025')
  })

  it('opens a fresh panel once the last one has been closed', async () => {
    const { feature, leaves, close } = harness()
    await feature.load()
    await feature.openWordStudy('G0026')
    await close(leaves[0])
    await feature.openWordStudy('G0025')
    expect(leaves).toHaveLength(2)
    expect(panel(leaves[1]).model.view.number).toBe('G0025')
  })

  it('persists the number under study as the tab state', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    await feature.openWordStudy('G0026')
    expect(leaves[0].getViewState()).toEqual({
      type: WORD_STUDY_VIEW_TYPE,
      state: { strongs: 'G0026' },
    })
  })

  it('comes back to its number when the layout is restored', async () => {
    const { feature, restore } = harness()
    await feature.load()
    const leaf = await restore({ strongs: 'G0026' })
    expect(panel(leaf).model.view).toMatchObject({
      number: 'G0026',
      status: 'ok',
    })
  })

  it('restores empty when the saved layout carried no number', async () => {
    const { feature, restore } = harness()
    await feature.load()
    const leaf = await restore({})
    expect(panel(leaf).model.view.status).toBe('empty')
    expect(panel(leaf).getDisplayText()).toBe('Word study')
  })

  it('notices a number the dictionaries have no entry for', async () => {
    const { feature, leaves } = harness()
    await feature.load()
    await feature.openWordStudy('G9999')
    expect(panel(leaves[0]).model.view).toMatchObject({
      number: 'G9999',
      status: 'no-entry',
    })
  })

  it('offers the etymology and the family siblings of the number it shows', async () => {
    const { feature, leaves } = harness({
      dictionary: fakeDictionary(['H0001G', 'H0001H', 'H3050']),
    })
    await feature.load()
    await feature.openWordStudy('H0001G')
    expect(panel(leaves[0]).model.view).toMatchObject({
      siblings: ['H0001H'],
      etymology: [
        { text: 'from ', number: null },
        { text: 'H3050', number: 'H3050' },
        { text: ';', number: null },
      ],
      etymologyAttribution: "Etymology: Strong's (1890, public domain)",
    })
  })

  it('retargets the panel when a link inside it is activated plainly', async () => {
    const { feature, leaves } = harness({
      dictionary: fakeDictionary(['H0001G', 'H0001H', 'H3050']),
    })
    await feature.load()
    await feature.openWordStudy('H0001G')
    await panel(leaves[0]).model.open('H0001H')
    expect(leaves).toHaveLength(1)
    expect(panel(leaves[0]).model.view.number).toBe('H0001H')
  })

  it('spawns a second panel when a link inside it asks for a new pane', async () => {
    const { feature, leaves } = harness({
      dictionary: fakeDictionary(['H0001G', 'H0001H', 'H3050']),
    })
    await feature.load()
    await feature.openWordStudy('H0001G')
    await panel(leaves[0]).model.open('H3050', { newPane: true })
    expect(leaves).toHaveLength(2)
    expect(panel(leaves[0]).model.view.number).toBe('H0001G')
    expect(panel(leaves[1]).model.view.number).toBe('H3050')
  })

  it('degrades to an install affordance when the dictionaries are missing', async () => {
    const { feature, leaves } = harness({
      dictionary: {
        installed: async () => false,
        entryFor: async () => null,
        install: async () => {},
        attribution: '',
        etymologyAttribution: '',
      },
    })
    await feature.load()
    await feature.openWordStudy('G0026')
    expect(panel(leaves[0]).model.view).toMatchObject({
      status: 'no-dictionary',
      install: { busy: false, error: null },
    })
  })

  it('degrades the same way when the dictionaries are not wired up at all', async () => {
    const { feature, leaves } = harness({ dictionary: null })
    await feature.load()
    await feature.openWordStudy('G0026')
    expect(panel(leaves[0]).model.view.status).toBe('no-dictionary')
  })
})
