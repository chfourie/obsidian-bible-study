import { describe, expect, it, vi } from 'vitest'
import type { Plugin } from 'obsidian'
import { RibbonMenuFeature } from './ribbon-menu-feature'

const harness = () => {
  const commands: { id: string; name: string; callback: () => void }[] = []
  const ribbons: { icon: string; title: string; callback: () => void }[] = []
  const plugin = {
    addCommand: (command: { id: string; name: string; callback: () => void }) => {
      commands.push(command)
      return command
    },
    addRibbonIcon: (icon: string, title: string, callback: () => void) => {
      ribbons.push({ icon, title, callback })
      return document.createElement('div')
    },
  } as unknown as Plugin
  const actions = {
    openReader: vi.fn(),
    openStudyPanel: vi.fn(),
    installedBooks: vi.fn(async () => []),
    openBook: vi.fn(),
  }
  return { feature: new RibbonMenuFeature(plugin, actions), commands, ribbons }
}

describe('RibbonMenuFeature', () => {
  it('registers a single ribbon icon and a command on load', async () => {
    const { feature, commands, ribbons } = harness()

    await feature.load()

    expect(ribbons.map((ribbon) => [ribbon.icon, ribbon.title])).toEqual([
      ['library', 'Scripture Study'],
    ])
    expect(commands.map((command) => command.id)).toEqual(['open-menu'])
  })

  it('survives ribbon and command triggers before the panel registers its api', async () => {
    const { feature, commands, ribbons } = harness()
    await feature.load()

    expect(() => ribbons[0].callback()).not.toThrow()
    expect(() => commands[0].callback()).not.toThrow()
  })

  it('cleans up its panel host on unload', async () => {
    const { feature } = harness()
    await feature.load()

    expect(() => feature.unload()).not.toThrow()
  })
})
