import { describe, expect, it } from 'vitest'
import type { ModuleManifest } from '../modules'
import {
  enumerateVerseIds,
  makeVerseId,
  parseReference,
  type Reference,
} from '../reference'
import type { Passage, PassageSource } from '../rendering'
import type { OccurrenceGroup } from '../vault-index'
import {
  ReaderPaneModel,
  type ReaderPaneDeps,
  type ReaderToggles,
} from './reader-pane-model'

type MockTexts = Record<string, Record<number, string>>

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

const passageSourceOver = (texts: MockTexts): PassageSource => ({
  passage: async (
    reference: Reference,
    translationId: string,
  ): Promise<Passage> => {
    const content = texts[translationId]
    if (!content) return { status: 'unavailable' }
    const verses = reference.ranges
      .flatMap(enumerateVerseIds)
      .filter((verseId) => content[verseId] !== undefined)
      .map((verseId) => ({
        verseId,
        segments: [{ text: content[verseId], redLetter: false }],
      }))
    if (verses.length === 0) return { status: 'unavailable' }
    return { status: 'ok', verses, attribution: null }
  },
})

const DEFAULT_TOGGLES: ReaderToggles = {
  details: 'inline',
  nav: 'tree',
  layout: 'verse-per-line',
}

const john15Texts = (): MockTexts => ({
  web: {
    [makeVerseId(43, 15, 1)]: 'I am the true vine.',
    [makeVerseId(43, 15, 2)]: 'Every branch in me.',
    [makeVerseId(43, 15, 3)]: 'You are already pruned.',
    [makeVerseId(43, 15, 4)]: 'Remain in me.',
    [makeVerseId(43, 15, 5)]: 'I am the vine.',
  },
})

const modelWith = (
  overrides: Partial<ReaderPaneDeps> = {},
  toggles: ReaderToggles = DEFAULT_TOGGLES,
  translationId: string | null = 'web',
): ReaderPaneModel =>
  new ReaderPaneModel(
    {
      passages: passageSourceOver(john15Texts()),
      installedTranslations: async () => [manifest('web')],
      intersecting: () => [],
      ...overrides,
    },
    { toggles, translationId },
  )

const ref = (text: string): Reference => {
  const parsed = parseReference(text, { translationIds: [] })
  if (parsed === null) throw new Error(`unparseable reference: ${text}`)
  return parsed.reference
}

const group = (file: string, annotation: boolean): OccurrenceGroup => ({
  file,
  annotation,
  occurrences: [],
})

describe('verse indicators', () => {
  it('marks verses with annotation and intersecting-note counts', async () => {
    const verse4 = makeVerseId(43, 15, 4)
    const model = modelWith({
      intersecting: (reference) =>
        reference.ranges.some((range) => range.startId === verse4)
          ? [
              group('Annotations/John 15.4.md', true),
              group('Sermons/Fruitfulness.md', false),
              group('Topics/Union.md', false),
            ]
          : [],
    })

    await model.openAt(ref('John 15:4'), 'web')

    const rows = model.view.rows
    expect(rows[3].annotations).toBe(1)
    expect(rows[3].mentions).toBe(2)
    expect(rows[0].annotations).toBe(0)
    expect(rows[0].mentions).toBe(0)
  })
})

describe('reader toggles', () => {
  it('seeds the three toggles from the configured defaults', () => {
    const model = modelWith({}, {
      details: 'side-panel',
      nav: 'breadcrumb',
      layout: 'continuous',
    })

    expect(model.view.toggles).toEqual({
      details: 'side-panel',
      nav: 'breadcrumb',
      layout: 'continuous',
    })
  })

  it('switches each toggle independently and notifies subscribers', () => {
    const model = modelWith()
    let notified = 0
    model.subscribe(() => notified++)

    model.setToggle('details', 'side-panel')
    model.setToggle('layout', 'continuous')

    expect(model.view.toggles).toEqual({
      details: 'side-panel',
      nav: 'tree',
      layout: 'continuous',
    })
    expect(notified).toBe(2)
  })

  it('stops notifying after unsubscribe', () => {
    const model = modelWith()
    let notified = 0
    const unsubscribe = model.subscribe(() => notified++)

    unsubscribe()
    model.setToggle('nav', 'breadcrumb')

    expect(notified).toBe(0)
  })
})

describe('opening the reader at a reference', () => {
  it('loads the chapter containing the reference with per-verse rows', async () => {
    const model = modelWith()

    await model.openAt(ref('John 15:4'), 'web')

    const view = model.view
    expect(view.status).toBe('ok')
    expect(view.title).toBe('John 15')
    expect(view.position).toEqual({ book: 43, chapter: 15 })
    expect(view.rows.map((row) => row.label)).toEqual(['1', '2', '3', '4', '5'])
    expect(view.rows[3].segments[0].text).toBe('Remain in me.')
  })

  it('shows an unavailable state when the translation has no content', async () => {
    const model = modelWith({}, DEFAULT_TOGGLES, 'nkjv')

    await model.openAt(ref('John 15:4'), 'nkjv')

    expect(model.view.status).toBe('unavailable')
    expect(model.view.rows).toEqual([])
  })

  it('nudges installation when no translation is available at all', async () => {
    const model = modelWith(
      { installedTranslations: async () => [] },
      DEFAULT_TOGGLES,
      null,
    )

    await model.openAt(ref('John 15:4'), null)

    expect(model.view.status).toBe('no-translation')
  })

  it('falls back to the first installed translation when none is configured', async () => {
    const model = modelWith({}, DEFAULT_TOGGLES, null)

    await model.openAt(ref('John 15:4'), null)

    expect(model.view.status).toBe('ok')
    expect(model.view.translations).toEqual([
      { id: 'web', label: 'WEB', active: true },
    ])
  })

  it('highlights the verses of the entry reference and shows the banner', async () => {
    const model = modelWith()

    await model.openAt(ref('John 15:4-5'), 'web')

    const view = model.view
    expect(view.rows.map((row) => row.highlighted)).toEqual([
      false,
      false,
      false,
      true,
      true,
    ])
    expect(view.banner).toBe('Opened at John 15:4-5')
  })
})
