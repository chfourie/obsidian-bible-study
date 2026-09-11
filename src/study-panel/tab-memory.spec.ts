import { describe, expect, it } from 'vitest'
import { TabMemory } from './tab-memory'

type Tab = { id: string }

describe('TabMemory', () => {
  it('starts a tab on the study tab with nothing unfolded or collapsed', () => {
    const memory = new TabMemory<Tab>()

    expect(memory.stateFor({ id: 'a' })).toEqual({
      subTab: 'chapter',
      expanded: new Set(),
      collapsedTranslations: new Set(),
      annotationsStartExpanded: false,
      annotationsArranged: false,
      toggledAnnotations: new Set(),
    })
  })

  it('starts a tab’s annotations open when told they start expanded', () => {
    const memory = new TabMemory<Tab>(() => true)

    expect(memory.stateFor({ id: 'a' }).annotationsStartExpanded).toBe(true)
    expect(memory.stateFor({ id: 'a' }).toggledAnnotations.size).toBe(0)
  })

  it('reads the annotation default afresh for each new tab, leaving followed tabs as they were', () => {
    let startExpanded = false
    const memory = new TabMemory<Tab>(() => startExpanded)
    const earlier = { id: 'a' }
    memory.stateFor(earlier)

    startExpanded = true

    expect(memory.stateFor(earlier).annotationsStartExpanded).toBe(false)
    expect(memory.stateFor({ id: 'b' }).annotationsStartExpanded).toBe(true)
  })

  it('hands a changed annotation default to the tabs that have arranged no annotation row', () => {
    let startExpanded = false
    const memory = new TabMemory<Tab>(() => startExpanded)
    const arranged = { id: 'a' }
    const untouched = { id: 'b' }
    memory.stateFor(arranged).annotationsArranged = true
    memory.stateFor(arranged).toggledAnnotations = new Set([
      'Annotations/Vine.md',
    ])
    memory.stateFor(untouched)

    startExpanded = true
    memory.adoptAnnotationDefault()

    expect(memory.stateFor(untouched).annotationsStartExpanded).toBe(true)
    expect(memory.stateFor(arranged).annotationsStartExpanded).toBe(false)
    expect([...memory.stateFor(arranged).toggledAnnotations]).toEqual([
      'Annotations/Vine.md',
    ])
  })

  it('leaves a tab arranged back to how its annotations started as it stands', () => {
    let startExpanded = false
    const memory = new TabMemory<Tab>(() => startExpanded)
    const foldedAgain = { id: 'a' }
    memory.stateFor(foldedAgain).annotationsArranged = true

    startExpanded = true
    memory.adoptAnnotationDefault()

    expect(memory.stateFor(foldedAgain).annotationsStartExpanded).toBe(false)
  })

  it('hands the same tab back its own state', () => {
    const memory = new TabMemory<Tab>()
    const tab = { id: 'a' }
    memory.stateFor(tab).subTab = 'selection'
    memory.stateFor(tab).expanded = new Set(['John 15:1'])
    memory.stateFor(tab).collapsedTranslations = new Set(['kjv'])
    memory.stateFor(tab).toggledAnnotations = new Set(['Annotations/Vine.md'])

    expect(memory.stateFor(tab).subTab).toBe('selection')
    expect([...memory.stateFor(tab).expanded]).toEqual(['John 15:1'])
    expect([...memory.stateFor(tab).collapsedTranslations]).toEqual(['kjv'])
    expect([...memory.stateFor(tab).toggledAnnotations]).toEqual([
      'Annotations/Vine.md',
    ])
  })

  it('keeps two tabs on the same content independent', () => {
    const memory = new TabMemory<Tab>()
    const first = { id: 'a' }
    const second = { id: 'a' }
    memory.stateFor(first).subTab = 'selection'
    memory.stateFor(first).expanded = new Set(['John 15:1'])

    expect(memory.stateFor(second).subTab).toBe('chapter')
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
