import { describe, expect, it } from 'vitest'
import { TabMemory } from './tab-memory'

type Tab = { id: string }

describe('TabMemory', () => {
  it('starts a tab with nothing unfolded', () => {
    const memory = new TabMemory<Tab>()

    expect(memory.stateFor({ id: 'a' })).toEqual({ expanded: new Set() })
  })

  it('hands the same tab back its own state', () => {
    const memory = new TabMemory<Tab>()
    const tab = { id: 'a' }
    memory.stateFor(tab).expanded = new Set(['John 15:1'])

    expect([...memory.stateFor(tab).expanded]).toEqual(['John 15:1'])
  })

  it('keeps two tabs on the same content independent', () => {
    const memory = new TabMemory<Tab>()
    const first = { id: 'a' }
    const second = { id: 'a' }
    memory.stateFor(first).expanded = new Set(['John 15:1'])

    expect(memory.stateFor(second).expanded.size).toBe(0)
  })

  it('forgets tabs that are no longer open', () => {
    const memory = new TabMemory<Tab>()
    const closed = { id: 'a' }
    const open = { id: 'b' }
    memory.stateFor(closed).expanded = new Set(['John 15:1'])
    memory.stateFor(open).expanded = new Set(['John 15:1'])

    memory.retain([open])

    expect(memory.stateFor(closed).expanded.size).toBe(0)
    expect(memory.stateFor(open).expanded.size).toBe(1)
  })
})
