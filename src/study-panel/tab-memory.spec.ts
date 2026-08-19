import { describe, expect, it } from 'vitest'
import { TabMemory } from './tab-memory'

type Tab = { id: string }

describe('TabMemory', () => {
  it('starts a tab on the translations sub-tab with nothing folded', () => {
    const memory = new TabMemory<Tab>()

    expect(memory.stateFor({ id: 'a' })).toEqual({
      subTab: 'translations',
      folded: new Set(),
    })
  })

  it('hands the same tab back its own state', () => {
    const memory = new TabMemory<Tab>()
    const tab = { id: 'a' }
    memory.stateFor(tab).subTab = 'notes'

    expect(memory.stateFor(tab).subTab).toBe('notes')
  })

  it('keeps two tabs on the same content independent', () => {
    const memory = new TabMemory<Tab>()
    const first = { id: 'a' }
    const second = { id: 'a' }
    memory.stateFor(first).subTab = 'notes'

    expect(memory.stateFor(second).subTab).toBe('translations')
  })

  it('forgets tabs that are no longer open', () => {
    const memory = new TabMemory<Tab>()
    const closed = { id: 'a' }
    const open = { id: 'b' }
    memory.stateFor(closed).subTab = 'notes'
    memory.stateFor(open).subTab = 'notes'

    memory.retain([open])

    expect(memory.stateFor(closed).subTab).toBe('translations')
    expect(memory.stateFor(open).subTab).toBe('notes')
  })
})
