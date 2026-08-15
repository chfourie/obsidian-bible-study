import { describe, expect, it, vi } from 'vitest'
import { WorkspaceLeaf, type Plugin } from 'obsidian'
import { DEFAULT_SETTINGS } from '../data-access'
import type { ModuleManifest, ModuleStore } from '../modules'
import { makeVerseId, parseReference, type Reference } from '../reference'
import { VaultReferenceIndex } from '../vault-index'
import { READER_VIEW_TYPE, ReaderFeature } from './reader-feature'
import { ReaderView } from './reader-view'

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

type FakeLeaf = WorkspaceLeaf & { detached?: boolean }

const harness = () => {
  const leaves: FakeLeaf[] = []
  let factory: ((leaf: WorkspaceLeaf) => unknown) | null = null
  const revealLeaf = vi.fn(async () => {})
  const commands: { id: string; callback: () => void }[] = []
  const ribbons: { icon: string; title: string; callback: () => void }[] = []
  const workspace = {
    getLeavesOfType: (type: string) =>
      type === READER_VIEW_TYPE ? leaves.filter((leaf) => !leaf.detached) : [],
    getLeaf: () => {
      const leaf = new WorkspaceLeaf() as FakeLeaf
      leaf.setViewState = async () => {
        if (factory) leaf.view = factory(leaf) as WorkspaceLeaf['view']
        leaves.push(leaf)
      }
      return leaf
    },
    revealLeaf,
  }
  const plugin = {
    app: { workspace },
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
  const feature = new ReaderFeature(plugin, fakeStore(), new VaultReferenceIndex())
  feature.useSettings({ ...DEFAULT_SETTINGS, defaultTranslationId: 'web' })
  return { feature, leaves, commands, ribbons, revealLeaf }
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
  it('registers the reader view, a command, and a ribbon icon on load', async () => {
    const { feature, commands, ribbons } = harness()

    await feature.load()

    expect(commands.map((command) => command.id)).toEqual(['open-reader'])
    expect(ribbons).toHaveLength(1)
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
    expect(view.model.view.banner).toBe('Opened at John 15:1')
    expect(revealLeaf).toHaveBeenCalled()
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

  it('seeds new panes with the reader toggle defaults from settings', async () => {
    const { feature, leaves } = harness()
    feature.useSettings({
      ...DEFAULT_SETTINGS,
      defaultTranslationId: 'web',
      readerDetailsDefault: 'side-panel',
      readerNavDefault: 'breadcrumb',
      readerLayoutDefault: 'continuous',
    })
    await feature.load()

    feature.openReference(ref('John 15:1'), 'web')
    await flushAsync()

    const view = leaves[0].view as ReaderView
    expect(view.model.view.toggles).toEqual({
      details: 'side-panel',
      nav: 'breadcrumb',
      layout: 'continuous',
    })
  })
})
