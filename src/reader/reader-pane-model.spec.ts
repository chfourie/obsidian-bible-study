import { describe, expect, it } from 'vitest'
import type { ModuleManifest } from '../modules'
import {
  enumerateVerseIds,
  makeVerseId,
  parseReference,
  rangeContains,
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
  annotationOrdering?: 'created-oldest-first' | 'path-a-z',
): ReaderPaneModel =>
  new ReaderPaneModel(
    {
      passages: passageSourceOver(john15Texts()),
      installedTranslations: async () => [manifest('web')],
      intersecting: () => [],
      annotationDetails: async () => null,
      ...overrides,
    },
    { toggles, translationId, annotationOrdering },
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

describe('opening without an entry reference', () => {
  it('opens at a plain position with no banner or highlight', async () => {
    const model = modelWith()

    await model.openPosition({ book: 43, chapter: 15 })

    const view = model.view
    expect(view.status).toBe('ok')
    expect(view.banner).toBe(null)
    expect(view.rows.every((row) => !row.highlighted)).toBe(true)
  })
})

describe('entry banner dismissal', () => {
  it('hides the banner but keeps the highlight', async () => {
    const model = modelWith()
    await model.openAt(ref('John 15:4-5'), 'web')

    model.dismissBanner()

    expect(model.view.banner).toBe(null)
    expect(model.view.rows[3].highlighted).toBe(true)
  })
})

describe('attribution', () => {
  it('surfaces the passage attribution line under the chapter', async () => {
    const model = modelWith({
      passages: {
        passage: async () => ({
          status: 'ok',
          verses: [
            {
              verseId: makeVerseId(43, 15, 1),
              segments: [{ text: 'I am the true vine.', redLetter: false }],
            },
          ],
          attribution: 'New King James Version®, Copyright © 1982',
        }),
      },
    })

    await model.openAt(ref('John 15:1'), 'web')

    expect(model.view.attribution).toBe(
      'New King James Version®, Copyright © 1982',
    )
  })
})

describe('chapter navigation', () => {
  const openJohn15 = async (
    overrides: Partial<ReaderPaneDeps> = {},
  ): Promise<ReaderPaneModel> => {
    const model = modelWith(overrides)
    await model.openAt(ref('John 15:4'), 'web')
    return model
  }

  it('steps to the next and previous chapter within a book', async () => {
    const model = await openJohn15()

    await model.nextChapter()
    expect(model.view.position).toEqual({ book: 43, chapter: 16 })

    await model.previousChapter()
    expect(model.view.position).toEqual({ book: 43, chapter: 15 })
  })

  it('crosses book boundaries at the edges of a book', async () => {
    const model = await openJohn15()

    await model.goTo(43, 21)
    await model.nextChapter()
    expect(model.view.position).toEqual({ book: 44, chapter: 1 })

    await model.previousChapter()
    expect(model.view.position).toEqual({ book: 43, chapter: 21 })
  })

  it('stays put at the very start and end of the canon', async () => {
    const model = await openJohn15()

    await model.goTo(1, 1)
    await model.previousChapter()
    expect(model.view.position).toEqual({ book: 1, chapter: 1 })

    await model.goTo(66, 22)
    await model.nextChapter()
    expect(model.view.position).toEqual({ book: 66, chapter: 22 })
  })

  it('clears entry highlight and banner once the user navigates away', async () => {
    const model = await openJohn15()

    await model.nextChapter()
    await model.previousChapter()

    expect(model.view.banner).toBe(null)
    expect(model.view.rows.every((row) => !row.highlighted)).toBe(true)
  })

  it('notifies subscribers as a navigation loads', async () => {
    const model = await openJohn15()
    let notified = 0
    model.subscribe(() => notified++)

    await model.nextChapter()

    expect(notified).toBeGreaterThanOrEqual(2)
  })
})

describe('overlapping loads', () => {
  it('ignores a stale chapter load that resolves after a newer one', async () => {
    let releaseChapter15 = (): void => {}
    const gate = new Promise<void>((resolve) => {
      releaseChapter15 = resolve
    })
    const texts: MockTexts = {
      web: {
        ...john15Texts().web,
        [makeVerseId(43, 16, 1)]: 'I have spoken these things.',
      },
    }
    const source = passageSourceOver(texts)
    const model = modelWith({
      passages: {
        passage: async (reference, translationId) => {
          const chapter15 = rangeContains(
            reference.ranges[0],
            makeVerseId(43, 15, 1),
          )
          if (chapter15) await gate
          return source.passage(reference, translationId)
        },
      },
    })

    const stale = model.goTo(43, 15)
    await new Promise((resolve) => window.setTimeout(resolve))
    await model.goTo(43, 16)
    releaseChapter15()
    await stale

    expect(model.view.position).toEqual({ book: 43, chapter: 16 })
    expect(model.view.status).toBe('ok')
    expect(model.view.rows.map((row) => row.segments[0].text)).toEqual([
      'I have spoken these things.',
    ])
  })
})

describe('translation switching', () => {
  it('reloads the chapter in the newly selected translation', async () => {
    const model = modelWith({
      passages: passageSourceOver({
        ...john15Texts(),
        kjv: { [makeVerseId(43, 15, 1)]: 'I am the true vine (KJV).' },
      }),
      installedTranslations: async () => [manifest('web'), manifest('kjv')],
    })
    await model.openAt(ref('John 15:1'), 'web')

    await model.setTranslation('kjv')

    const view = model.view
    expect(view.rows).toHaveLength(1)
    expect(view.rows[0].segments[0].text).toBe('I am the true vine (KJV).')
    expect(view.translations).toEqual([
      { id: 'web', label: 'WEB', active: false },
      { id: 'kjv', label: 'KJV', active: true },
    ])
  })
})

describe('verse details', () => {
  const verse4 = makeVerseId(43, 15, 4)
  const twoTranslations = (): Partial<ReaderPaneDeps> => ({
    passages: passageSourceOver({
      ...john15Texts(),
      kjv: { [makeVerseId(43, 15, 1)]: 'I am the true vine (KJV).' },
    }),
    installedTranslations: async () => [manifest('web'), manifest('kjv')],
    intersecting: (reference) =>
      reference.ranges.some((range) => rangeContains(range, verse4))
        ? [
            group('Annotations/John 15.4.md', true),
            group('Sermons/Fruitfulness.md', false),
          ]
        : [],
    annotationDetails: async (file) =>
      file === 'Annotations/John 15.4.md'
        ? { body: 'Abiding means remaining.', created: 1000 }
        : null,
  })

  it('expands a clicked verse inline with every installed translation stacked', async () => {
    const model = modelWith(twoTranslations())
    await model.openAt(ref('John 15:4'), 'web')

    await model.selectVerse(verse4)

    expect(model.view.rows[3].expanded).toBe(true)
    expect(model.view.details[verse4]).toEqual({
      verseId: verse4,
      title: 'John 15:4',
      translations: [
        { id: 'web', label: 'WEB', text: 'Remain in me.' },
        { id: 'kjv', label: 'KJV', text: null },
      ],
      annotations: [
        {
          file: 'Annotations/John 15.4.md',
          title: 'John 15.4',
          body: 'Abiding means remaining.',
        },
      ],
      mentions: [{ file: 'Sermons/Fruitfulness.md' }],
    })
  })

  it('collapses an expanded verse when clicked again', async () => {
    const model = modelWith(twoTranslations())
    await model.openAt(ref('John 15:4'), 'web')

    await model.selectVerse(verse4)
    await model.selectVerse(verse4)

    expect(model.view.rows[3].expanded).toBe(false)
  })

  it('selects instead of expanding when details show in the side panel', async () => {
    const model = modelWith(twoTranslations(), {
      ...DEFAULT_TOGGLES,
      details: 'side-panel',
    })
    await model.openAt(ref('John 15:4'), 'web')

    await model.selectVerse(verse4)
    await model.selectVerse(verse4)

    expect(model.view.selectedVerseId).toBe(verse4)
    expect(model.view.rows[3].expanded).toBe(false)
    expect(model.view.details[verse4]?.translations).toHaveLength(2)
  })
})

describe('annotation ordering in details', () => {
  const verse4 = makeVerseId(43, 15, 4)
  const annotated = (
    ordering?: 'created-oldest-first' | 'path-a-z',
  ): ReaderPaneModel =>
    modelWith(
      {
        intersecting: (reference) =>
          reference.ranges.some((range) => rangeContains(range, verse4))
            ? [
                group('Annotations/Zeal.md', true),
                group('Annotations/Abide.md', true),
              ]
            : [],
        annotationDetails: async (file) =>
          file === 'Annotations/Zeal.md'
            ? { body: 'older note', created: 100 }
            : { body: 'newer note', created: 200 },
      },
      DEFAULT_TOGGLES,
      'web',
      ordering,
    )

  it('orders annotations by creation date oldest first by default', async () => {
    const model = annotated()
    await model.openAt(ref('John 15:4'), 'web')

    await model.selectVerse(verse4)

    expect(
      model.view.details[verse4].annotations.map((block) => block.file),
    ).toEqual(['Annotations/Zeal.md', 'Annotations/Abide.md'])
  })

  it('orders annotations by file path when configured', async () => {
    const model = annotated('path-a-z')
    await model.openAt(ref('John 15:4'), 'web')

    await model.selectVerse(verse4)

    expect(
      model.view.details[verse4].annotations.map((block) => block.file),
    ).toEqual(['Annotations/Abide.md', 'Annotations/Zeal.md'])
  })
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

describe('annotate selection', () => {
  const verse2 = makeVerseId(43, 15, 2)
  const verse4 = makeVerseId(43, 15, 4)

  it('has no selection reference before a verse is selected', async () => {
    const model = modelWith()
    await model.openAt(ref('John 15:1'), 'web')

    expect(model.selectionReference()).toBe(null)
  })

  it('spans the selected verse when only one is selected', async () => {
    const model = modelWith()
    await model.openAt(ref('John 15:1'), 'web')

    await model.selectVerse(verse4)

    expect(model.selectionReference()).toEqual(ref('John 15:4'))
  })

  it('spans from the selected verse to an extended one', async () => {
    const model = modelWith()
    await model.openAt(ref('John 15:1'), 'web')

    await model.selectVerse(verse4)
    model.extendSelectionTo(verse2)

    expect(model.selectionReference()).toEqual(ref('John 15:2-4'))
    expect(model.view.selectionEndId).toBe(verse2)
  })

  it('clears the extended selection when a new verse is selected', async () => {
    const model = modelWith()
    await model.openAt(ref('John 15:1'), 'web')

    await model.selectVerse(verse4)
    model.extendSelectionTo(verse2)
    await model.selectVerse(verse2)

    expect(model.selectionReference()).toEqual(ref('John 15:2'))
  })
})

describe('occurrence refresh', () => {
  it('re-counts indicators and reloads open details from the index', async () => {
    const verse4 = makeVerseId(43, 15, 4)
    let groups: OccurrenceGroup[] = []
    const model = modelWith({
      intersecting: (reference) =>
        reference.ranges.some((range) => rangeContains(range, verse4))
          ? groups
          : [],
      annotationDetails: async () => ({ body: 'note body', created: 1 }),
    })
    await model.openAt(ref('John 15:4'), 'web')
    await model.selectVerse(verse4)
    expect(model.view.rows[3].annotations).toBe(0)

    groups = [group('Annotations/John 15.4.md', true)]
    await model.refreshOccurrences()

    expect(model.view.rows[3].annotations).toBe(1)
    expect(model.view.details[verse4].annotations).toEqual([
      {
        file: 'Annotations/John 15.4.md',
        title: 'John 15.4',
        body: 'note body',
      },
    ])
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
