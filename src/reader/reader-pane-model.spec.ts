import { describe, expect, it } from 'vitest'
import {
  enumerateVerseIds,
  makeVerseId,
  parseReference,
  rangeContains,
  referencesIntersect,
  type Reference,
} from '../reference'
import type { Passage, PassageSource } from '../rendering'
import type {
  CrossReference,
  CrossReferenceEditing,
} from '../cross-references'
import type { OccurrenceGroup } from '../vault-index'
import {
  paragraphsOf,
  ReaderPaneModel,
  type ReaderPaneDeps,
  type ReaderToggles,
} from './reader-pane-model'

type MockTexts = Record<string, Record<number, string>>

const translation = (id: string, strongsTagged = false) => ({
  id,
  label: id.toUpperCase(),
  name: `${id.toUpperCase()} Full Name`,
  strongsTagged,
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
  strongs: 'off',
  redLetter: 'off',
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

const crossReferencesOf = (
  overrides: Partial<CrossReferenceEditing> = {},
): CrossReferenceEditing => ({
  intersecting: () => [],
  create: async () => {},
  update: async () => {},
  delete: async () => {},
  ...overrides,
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
      availableTranslations: async () => [translation('web')],
      intersecting: () => [],
      crossReferences: crossReferencesOf(),
      annotationDetails: async () => null,
      strongs: {
        dictionariesInstalled: async () => false,
        entriesFor: async () => [],
        attribution: 'STEPBible CC BY 4.0',
      },
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

const flushAsync = async (): Promise<void> => {
  await new Promise((resolve) => window.setTimeout(resolve, 0))
}

describe('poetry and paragraph structure', () => {
  const structuredSource: PassageSource = {
    passage: async (reference: Reference): Promise<Passage> => {
      if (reference.book !== 43) return { status: 'unavailable' }
      return {
        status: 'ok',
        attribution: null,
        verses: [
          {
            verseId: makeVerseId(43, 15, 1),
            segments: [{ text: 'I am the true vine.', redLetter: false }],
            hasLineData: true,
            startsParagraph: true,
          },
          {
            verseId: makeVerseId(43, 15, 2),
            segments: [{ text: 'Every branch in me.', redLetter: false }],
          },
          {
            verseId: makeVerseId(43, 15, 3),
            segments: [
              {
                text: 'A poetic line, ',
                redLetter: false,
                lineStart: true,
                indent: 1,
              },
              {
                text: 'an indented line.',
                redLetter: false,
                lineStart: true,
                lineBreakBefore: true,
                indent: 2,
              },
            ],
            hasLineData: true,
          },
          {
            verseId: makeVerseId(43, 15, 4),
            segments: [{ text: 'Remain in me.', redLetter: false }],
          },
        ],
      }
    },
  }

  it('marks poetry rows and paragraph-starting rows', async () => {
    const model = modelWith({ passages: structuredSource })

    await model.openPosition({ book: 43, chapter: 15 })

    const rows = model.view.rows
    expect(rows.map((row) => row.poetry)).toEqual([false, false, true, false])
    expect(rows.map((row) => row.startsParagraph)).toEqual([
      true,
      false,
      false,
      false,
    ])
  })

  it('marks every Psalms row as poetry', async () => {
    const model = modelWith({
      passages: passageSourceOver({
        web: {
          [makeVerseId(19, 23, 1)]: 'The LORD is my shepherd.',
          [makeVerseId(19, 23, 2)]: 'He makes me lie down.',
        },
      }),
    })

    await model.openPosition({ book: 19, chapter: 23 })

    expect(model.view.rows.map((row) => row.poetry)).toEqual([true, true])
  })

  it('groups rows into paragraphs breaking at paragraph starts and around poetry', async () => {
    const model = modelWith({ passages: structuredSource })
    await model.openPosition({ book: 43, chapter: 15 })
    const rows = model.view.rows

    const paragraphs = paragraphsOf(rows)

    expect(
      paragraphs.map((paragraph) => paragraph.map((row) => row.verseId)),
    ).toEqual([
      [makeVerseId(43, 15, 1), makeVerseId(43, 15, 2)],
      [makeVerseId(43, 15, 3)],
      [makeVerseId(43, 15, 4)],
    ])
  })

  it('keeps rows without structure in one paragraph', async () => {
    const model = modelWith()
    await model.openPosition({ book: 43, chapter: 15 })

    const paragraphs = paragraphsOf(model.view.rows)

    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0]).toHaveLength(5)
  })
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

  it('reports both directions available mid-canon', async () => {
    const model = await openJohn15()

    expect(model.view.hasPreviousChapter).toBe(true)
    expect(model.view.hasNextChapter).toBe(true)
  })

  it('reports the unavailable direction at the edges of the canon', async () => {
    const model = await openJohn15()

    await model.goTo(1, 1)
    expect(model.view.hasPreviousChapter).toBe(false)
    expect(model.view.hasNextChapter).toBe(true)

    await model.goTo(66, 22)
    expect(model.view.hasPreviousChapter).toBe(true)
    expect(model.view.hasNextChapter).toBe(false)
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
      availableTranslations: async () => [translation('web'), translation('kjv')],
    })
    await model.openAt(ref('John 15:1'), 'web')

    await model.setTranslation('kjv')

    const view = model.view
    expect(view.rows).toHaveLength(1)
    expect(view.rows[0].segments[0].text).toBe('I am the true vine (KJV).')
    expect(view.translations).toEqual([
      { id: 'web', label: 'WEB', name: 'WEB Full Name', active: false },
      { id: 'kjv', label: 'KJV', name: 'KJV Full Name', active: true },
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
    availableTranslations: async () => [translation('web'), translation('kjv')],
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
        {
          id: 'web',
          label: 'WEB',
          name: 'WEB Full Name',
          segments: [{ text: 'Remain in me.', redLetter: false }],
        },
        { id: 'kjv', label: 'KJV', name: 'KJV Full Name', segments: null },
      ],
      annotations: [
        {
          file: 'Annotations/John 15.4.md',
          body: 'Abiding means remaining.',
        },
      ],
      mentions: [{ file: 'Sermons/Fruitfulness.md' }],
      crossReferences: [],
      strongs: [],
      strongsAttribution: null,
    })
  })

  it('collapses an expanded verse when clicked again', async () => {
    const model = modelWith(twoTranslations())
    await model.openAt(ref('John 15:4'), 'web')

    await model.selectVerse(verse4)
    await model.selectVerse(verse4)

    expect(model.view.rows[3].expanded).toBe(false)
  })

  it('prunes the details of a collapsed verse', async () => {
    const model = modelWith(twoTranslations())
    await model.openAt(ref('John 15:4'), 'web')

    await model.selectVerse(verse4)
    await model.selectVerse(verse4)

    expect(model.view.details[verse4]).toBeUndefined()
  })

  it('loads details for the selected verse when switching to the side panel', async () => {
    // Collapsing an inline verse prunes its details but keeps it selected;
    // switching Details to side-panel must reload them or the panel shows
    // a permanent "Loading…".
    const model = modelWith(twoTranslations())
    await model.openAt(ref('John 15:4'), 'web')
    await model.selectVerse(verse4)
    await model.selectVerse(verse4)

    model.setToggle('details', 'side-panel')
    await flushAsync()

    expect(model.view.details[verse4]?.translations).toHaveLength(2)
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

  it('re-sorts loaded details when the ordering setting changes', async () => {
    const model = annotated()
    await model.openAt(ref('John 15:4'), 'web')
    await model.selectVerse(verse4)

    model.setAnnotationOrdering('path-a-z')
    await flushAsync()

    expect(
      model.view.details[verse4].annotations.map((block) => block.file),
    ).toEqual(['Annotations/Abide.md', 'Annotations/Zeal.md'])
  })

  it('leaves details untouched when the ordering setting is unchanged', async () => {
    const model = annotated('path-a-z')
    await model.openAt(ref('John 15:4'), 'web')
    await model.selectVerse(verse4)
    let notified = 0
    model.subscribe(() => notified++)

    model.setAnnotationOrdering('path-a-z')
    await flushAsync()

    expect(notified).toBe(0)
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

  it('annotates the verse of the details block, not the latest selection', async () => {
    const verse5 = makeVerseId(43, 15, 5)
    const model = modelWith()
    await model.openAt(ref('John 15:1'), 'web')

    await model.selectVerse(verse2)
    await model.selectVerse(verse5)

    expect(model.annotationReference(verse2)).toEqual(ref('John 15:2'))
    expect(model.annotationReference(verse5)).toEqual(ref('John 15:5'))
  })

  it('annotates the whole selection span from a block inside it', async () => {
    const model = modelWith()
    await model.openAt(ref('John 15:1'), 'web')

    await model.selectVerse(verse4)
    model.extendSelectionTo(verse2)

    expect(model.annotationReference(verse4)).toEqual(ref('John 15:2-4'))
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
        body: 'note body',
      },
    ])
  })

  it('reloads only the details still on display', async () => {
    const verse4 = makeVerseId(43, 15, 4)
    const verse5 = makeVerseId(43, 15, 5)
    const detailLoads: string[] = []
    const model = modelWith({
      annotationDetails: async () => null,
      passages: {
        passage: async (reference, translationId) => {
          if (reference.ranges[0].startId === reference.ranges[0].endId)
            detailLoads.push(`${reference.ranges[0].startId}`)
          return passageSourceOver(john15Texts()).passage(
            reference,
            translationId,
          )
        },
      },
    })
    await model.openAt(ref('John 15:4'), 'web')
    await model.selectVerse(verse4)
    await model.selectVerse(verse5)
    await model.selectVerse(verse4)
    detailLoads.length = 0

    await model.refreshOccurrences()

    expect(detailLoads).toEqual([`${verse5}`])
    expect(model.view.details[verse4]).toBeUndefined()
  })

  it('prunes side-panel details for verses no longer selected on refresh', async () => {
    const verse4 = makeVerseId(43, 15, 4)
    const verse5 = makeVerseId(43, 15, 5)
    const model = modelWith({}, { ...DEFAULT_TOGGLES, details: 'side-panel' })
    await model.openAt(ref('John 15:4'), 'web')
    await model.selectVerse(verse4)
    await model.selectVerse(verse5)

    await model.refreshOccurrences()

    expect(model.view.details[verse4]).toBeUndefined()
    expect(model.view.details[verse5]).toBeDefined()
  })
})

describe('reader toggles', () => {
  it('seeds the toggles from the configured defaults', () => {
    const model = modelWith({}, {
      details: 'side-panel',
      nav: 'breadcrumb',
      layout: 'continuous',
      strongs: 'on',
      redLetter: 'on',
    })

    expect(model.view.toggles).toEqual({
      details: 'side-panel',
      nav: 'breadcrumb',
      layout: 'continuous',
      strongs: 'on',
      redLetter: 'on',
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
      strongs: 'off',
      redLetter: 'off',
    })
    expect(notified).toBe(2)
  })

  it('reloads the chapter when the red-letter toggle changes', async () => {
    let passageCalls = 0
    const counting: PassageSource = {
      passage: async (reference, translationId) => {
        passageCalls++
        return passageSourceOver(john15Texts()).passage(
          reference,
          translationId,
        )
      },
    }
    const model = modelWith({ passages: counting })
    await model.openPosition({ book: 43, chapter: 15 })
    const callsAfterOpen = passageCalls

    model.setToggle('redLetter', 'on')
    await flushAsync()

    expect(passageCalls).toBe(callsAfterOpen + 1)
    expect(model.view.status).toBe('ok')
  })

  it('refetches with the new toggle when red letter flips mid-load', async () => {
    let release = (): void => {}
    let passageCalls = 0
    let model: ReaderPaneModel
    const gated: PassageSource = {
      passage: async (reference, translationId) => {
        passageCalls++
        if (passageCalls === 1)
          await new Promise<void>((resolve) => (release = resolve))
        const derived = model.view.toggles.redLetter === 'on'
        const passage = await passageSourceOver(john15Texts()).passage(
          reference,
          translationId,
        )
        if (passage.status !== 'ok') return passage
        return {
          ...passage,
          verses: passage.verses.map((verse) => ({
            ...verse,
            segments: verse.segments.map((segment) => ({
              ...segment,
              redLetter: derived,
            })),
          })),
        }
      },
    }
    model = modelWith({ passages: gated })
    const opening = model.openPosition({ book: 43, chapter: 15 })
    await flushAsync()
    expect(model.view.status).toBe('loading')

    model.setToggle('redLetter', 'on')
    release()
    await opening
    await flushAsync()

    expect(model.view.status).toBe('ok')
    expect(model.view.rows[0].segments[0].redLetter).toBe(true)
  })

  it('follows a changed red-letter default until the user overrides it', async () => {
    const model = modelWith()
    await model.openPosition({ book: 43, chapter: 15 })

    model.setRedLetterDefault('on')
    await flushAsync()
    expect(model.view.toggles.redLetter).toBe('on')

    model.setToggle('redLetter', 'off')
    await flushAsync()
    model.setRedLetterDefault('on')
    await flushAsync()

    expect(model.view.toggles.redLetter).toBe('off')
  })

  it('reloads the chapter when an untouched pane follows a new default', async () => {
    let passageCalls = 0
    const counting: PassageSource = {
      passage: async (reference, translationId) => {
        passageCalls++
        return passageSourceOver(john15Texts()).passage(
          reference,
          translationId,
        )
      },
    }
    const model = modelWith({ passages: counting })
    await model.openPosition({ book: 43, chapter: 15 })
    const callsAfterOpen = passageCalls

    model.setRedLetterDefault('on')
    await flushAsync()

    expect(passageCalls).toBe(callsAfterOpen + 1)
    expect(model.view.status).toBe('ok')
  })

  it('reports whether the user has overridden the red-letter toggle', () => {
    const model = modelWith()
    expect(model.redLetterOverridden).toBe(false)

    model.setRedLetterDefault('on')
    expect(model.redLetterOverridden).toBe(false)

    model.setToggle('redLetter', 'off')
    expect(model.redLetterOverridden).toBe(true)
  })

  it('does not load a chapter when the red-letter toggle is set before opening', () => {
    let passageCalls = 0
    const counting: PassageSource = {
      passage: async (reference, translationId) => {
        passageCalls++
        return passageSourceOver(john15Texts()).passage(
          reference,
          translationId,
        )
      },
    }
    const model = modelWith({ passages: counting })

    model.setToggle('redLetter', 'on')

    expect(passageCalls).toBe(0)
    expect(model.view.toggles.redLetter).toBe('on')
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

describe('reader font scale', () => {
  const scaledModel = (fontScalePercent?: number): ReaderPaneModel =>
    new ReaderPaneModel(
      {
        passages: passageSourceOver(john15Texts()),
        availableTranslations: async () => [translation('web')],
        intersecting: () => [],
        crossReferences: crossReferencesOf(),
        annotationDetails: async () => null,
        strongs: {
          dictionariesInstalled: async () => false,
          entriesFor: async () => [],
          attribution: '',
        },
      },
      { toggles: DEFAULT_TOGGLES, translationId: 'web', fontScalePercent },
    )

  it('defaults to 100% when unconfigured', () => {
    expect(scaledModel().view.fontScalePercent).toBe(100)
  })

  it('seeds the scale from the configured default', () => {
    expect(scaledModel(130).view.fontScalePercent).toBe(130)
  })

  it('steps up and down by 10% and notifies subscribers', () => {
    const model = scaledModel()
    let notified = 0
    model.subscribe(() => notified++)

    model.increaseFontScale()
    model.increaseFontScale()
    model.decreaseFontScale()

    expect(model.view.fontScalePercent).toBe(110)
    expect(notified).toBe(3)
  })

  it('clamps at the range limits without notifying', () => {
    const model = scaledModel(200)
    let notified = 0
    model.subscribe(() => notified++)

    model.increaseFontScale()
    expect(model.view.fontScalePercent).toBe(200)

    const floor = scaledModel(50)
    floor.subscribe(() => notified++)
    floor.decreaseFontScale()
    expect(floor.view.fontScalePercent).toBe(50)
    expect(notified).toBe(0)
  })

  it('clamps a configured default outside the range', () => {
    expect(scaledModel(500).view.fontScalePercent).toBe(200)
    expect(scaledModel(10).view.fontScalePercent).toBe(50)
  })

  it('resets to the configured default', () => {
    const model = scaledModel(120)
    model.increaseFontScale()
    model.increaseFontScale()

    model.resetFontScale()

    expect(model.view.fontScalePercent).toBe(120)
  })

  it('resets to a default changed after construction, leaving the current scale alone', () => {
    const model = scaledModel(100)
    model.increaseFontScale()

    model.setDefaultFontScale(150)
    expect(model.view.fontScalePercent).toBe(110)

    model.resetFontScale()
    expect(model.view.fontScalePercent).toBe(150)
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
      { availableTranslations: async () => [] },
      DEFAULT_TOGGLES,
      null,
    )

    await model.openAt(ref('John 15:4'), null)

    expect(model.view.status).toBe('no-translation')
  })

  it('offers the suggested one-click install in the no-translation state', async () => {
    const model = modelWith(
      {
        availableTranslations: async () => [],
        firstRun: {
          translationName: 'World English Bible',
          install: async () => {},
        },
      },
      DEFAULT_TOGGLES,
      null,
    )

    await model.openAt(ref('John 15:4'), null)

    expect(model.view.installNudge).toEqual({
      translationName: 'World English Bible',
      busy: false,
      error: null,
    })
  })

  it('installs the suggested translation and starts reading it', async () => {
    let installed = false
    const model = modelWith(
      {
        availableTranslations: async () => (installed ? [translation('web')] : []),
        firstRun: {
          translationName: 'World English Bible',
          install: async () => {
            installed = true
          },
        },
      },
      DEFAULT_TOGGLES,
      null,
    )
    await model.openAt(ref('John 15:4'), null)

    await model.installSuggestedTranslation()

    expect(model.view.status).toBe('ok')
    expect(model.view.installNudge).toBe(null)
    expect(model.view.translations).toEqual([
      { id: 'web', label: 'WEB', name: 'WEB Full Name', active: true },
    ])
  })

  it('marks the nudge busy while the suggested install runs', async () => {
    let resolveInstall: () => void = () => {}
    const model = modelWith(
      {
        availableTranslations: async () => [],
        firstRun: {
          translationName: 'World English Bible',
          install: () =>
            new Promise<void>((resolve) => (resolveInstall = resolve)),
        },
      },
      DEFAULT_TOGGLES,
      null,
    )
    await model.openAt(ref('John 15:4'), null)

    const installing = model.installSuggestedTranslation()
    expect(model.view.installNudge?.busy).toBe(true)

    resolveInstall()
    await installing
    expect(model.view.installNudge?.busy).toBe(false)
  })

  it('keeps the nudge clickable and surfaces the error when the suggested install fails', async () => {
    let notified = 0
    const model = modelWith(
      {
        availableTranslations: async () => [],
        firstRun: {
          translationName: 'World English Bible',
          install: async () => {
            throw new Error('network gone')
          },
        },
      },
      DEFAULT_TOGGLES,
      null,
    )
    await model.openAt(ref('John 15:4'), null)
    model.subscribe(() => (notified += 1))

    await model.installSuggestedTranslation()

    expect(model.view.status).toBe('no-translation')
    expect(model.view.installNudge).toEqual({
      translationName: 'World English Bible',
      busy: false,
      error: 'network gone',
    })
    expect(notified).toBeGreaterThanOrEqual(2)
  })

  it('clears a previous install error when the nudge is retried', async () => {
    let installed = false
    let failNext = true
    const model = modelWith(
      {
        availableTranslations: async () => (installed ? [translation('web')] : []),
        firstRun: {
          translationName: 'World English Bible',
          install: async () => {
            if (failNext) throw new Error('network gone')
            installed = true
          },
        },
      },
      DEFAULT_TOGGLES,
      null,
    )
    await model.openAt(ref('John 15:4'), null)
    await model.installSuggestedTranslation()
    failNext = false

    await model.installSuggestedTranslation()

    expect(model.view.status).toBe('ok')
    expect(model.view.installNudge).toBe(null)
  })

  it('falls back to the first installed translation when none is configured', async () => {
    const model = modelWith({}, DEFAULT_TOGGLES, null)

    await model.openAt(ref('John 15:4'), null)

    expect(model.view.status).toBe('ok')
    expect(model.view.translations).toEqual([
      { id: 'web', label: 'WEB', name: 'WEB Full Name', active: true },
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



const strongsEntry = (strongs: string) => ({
  strongs,
  lemma: `lemma-${strongs}`,
  transliteration: `translit-${strongs}`,
  gloss: `gloss-${strongs}`,
  definition: `definition of ${strongs}`,
})

const strongsDeps = (
  installed = true,
): Pick<ReaderPaneDeps, 'availableTranslations' | 'strongs'> => ({
  availableTranslations: async () => [translation('bsb', true)],
  strongs: {
    dictionariesInstalled: async () => installed,
    entriesFor: async (numbers) => numbers.map(strongsEntry),
    attribution: 'STEPBible CC BY 4.0',
  },
})

const bsbTexts = (): MockTexts => ({
  bsb: john15Texts().web,
})

describe("Strong's mode availability", () => {
  it('offers the toggle when the translation is tagged and dictionaries are installed', async () => {
    const model = modelWith(
      { passages: passageSourceOver(bsbTexts()), ...strongsDeps() },
      DEFAULT_TOGGLES,
      'bsb',
    )

    await model.openPosition({ book: 43, chapter: 15 })

    expect(model.view.strongsAvailable).toBe(true)
  })

  it('offers no toggle for an untagged translation', async () => {
    const model = modelWith({
      strongs: strongsDeps().strongs,
    })

    await model.openPosition({ book: 43, chapter: 15 })

    expect(model.view.strongsAvailable).toBe(false)
  })

  it('offers no toggle when the dictionaries are not installed', async () => {
    const model = modelWith({
      passages: passageSourceOver(bsbTexts()),
      ...strongsDeps(false),
    })

    await model.openPosition({ book: 43, chapter: 15 })

    expect(model.view.strongsAvailable).toBe(false)
  })

  it('is inactive while unavailable even when toggled on by default', async () => {
    const model = modelWith(
      { strongs: strongsDeps().strongs },
      { ...DEFAULT_TOGGLES, strongs: 'on' },
    )

    await model.openPosition({ book: 43, chapter: 15 })

    expect(model.view.strongsMode).toBe(false)
  })

  it('activates from the configured default when available', async () => {
    const model = modelWith(
      { passages: passageSourceOver(bsbTexts()), ...strongsDeps() },
      { ...DEFAULT_TOGGLES, strongs: 'on' },
      'bsb',
    )

    await model.openPosition({ book: 43, chapter: 15 })

    expect(model.view.strongsMode).toBe(true)
  })

  it('activates via the toggle', async () => {
    const model = modelWith(
      { passages: passageSourceOver(bsbTexts()), ...strongsDeps() },
      DEFAULT_TOGGLES,
      'bsb',
    )
    await model.openPosition({ book: 43, chapter: 15 })

    model.setToggle('strongs', 'on')

    expect(model.view.strongsMode).toBe(true)
  })
})

describe("Strong's word lookup", () => {
  const openedModel = async (): Promise<ReaderPaneModel> => {
    const model = modelWith(
      { passages: passageSourceOver(bsbTexts()), ...strongsDeps() },
      { ...DEFAULT_TOGGLES, strongs: 'on' },
      'bsb',
    )
    await model.openPosition({ book: 43, chapter: 15 })
    return model
  }

  it('renders dictionary entries for a tapped word in tag order with attribution', async () => {
    const model = await openedModel()
    const verseId = makeVerseId(43, 15, 4)

    await model.selectWord(verseId, ['G3306', 'G1722'])

    const details = model.view.details[verseId]
    expect(details.strongs.map((entry) => entry.strongs)).toEqual([
      'G3306',
      'G1722',
    ])
    expect(details.strongs[0].gloss).toBe('gloss-G3306')
    expect(details.strongsAttribution).toBe('STEPBible CC BY 4.0')
  })

  it('replaces the entries when another word is tapped', async () => {
    const model = await openedModel()
    const verseId = makeVerseId(43, 15, 4)
    await model.selectWord(verseId, ['G3306'])

    await model.selectWord(verseId, ['G2222'])

    expect(
      model.view.details[verseId].strongs.map((entry) => entry.strongs),
    ).toEqual(['G2222'])
  })

  it('keeps a plain verse selection free of dictionary entries', async () => {
    const model = await openedModel()
    const verseId = makeVerseId(43, 15, 4)
    await model.selectWord(verseId, ['G3306'])
    await model.selectVerse(verseId)

    await model.selectVerse(verseId)

    expect(model.view.details[verseId].strongs).toEqual([])
    expect(model.view.details[verseId].strongsAttribution).toBe(null)
  })
})

describe('cross-references in verse details', () => {
  const verse4 = makeVerseId(43, 15, 4)
  const vineCrossReference: CrossReference = {
    id: 'xr-vine',
    members: [ref('John 15:1-8'), ref('Psalm 80:8-16'), ref('Romans 11:17-24')],
    description: 'Vine and vineyard imagery for Israel',
  }
  const storeOf = (...entries: CrossReference[]): CrossReferenceEditing =>
    crossReferencesOf({
      intersecting: (reference) =>
        entries.filter((entry) =>
          entry.members.some((member) => referencesIntersect(member, reference)),
        ),
    })
  const psalmTexts = (): MockTexts => ({
    web: {
      ...john15Texts().web,
      [makeVerseId(19, 80, 8)]: 'You brought a vine out of Egypt.',
    },
    kjv: {
      ...john15Texts().web,
      [makeVerseId(19, 80, 8)]: 'Thou hast brought a vine out of Egypt.',
    },
  })

  it('lists an intersecting cross-reference with only the other members and its description', async () => {
    const model = modelWith({ crossReferences: storeOf(vineCrossReference) })
    await model.openAt(ref('John 15:4'), 'web')

    await model.selectVerse(verse4)

    expect(model.view.details[verse4].crossReferences).toEqual([
      {
        id: 'xr-vine',
        description: 'Vine and vineyard imagery for Israel',
        members: [
          { label: 'Psalms 80:8-16', reference: ref('Psalm 80:8-16'), index: 1 },
          { label: 'Romans 11:17-24', reference: ref('Romans 11:17-24'), index: 2 },
        ],
        allMembers: vineCrossReference.members,
      },
    ])
  })

  it('leaves non-intersecting cross-references out of the details', async () => {
    const elsewhere: CrossReference = {
      id: 'xr-elsewhere',
      members: [ref('John 15:9'), ref('Psalm 23:1')],
      description: null,
    }
    const model = modelWith({
      crossReferences: storeOf(vineCrossReference, elsewhere),
    })
    await model.openAt(ref('John 15:4'), 'web')

    await model.selectVerse(verse4)

    expect(
      model.view.details[verse4].crossReferences.map((entry) => entry.id),
    ).toEqual(['xr-vine'])
  })

  it('resurfaces the cross-reference after navigating to a listed member', async () => {
    const model = modelWith({
      passages: passageSourceOver(psalmTexts()),
      crossReferences: storeOf(vineCrossReference),
    })
    await model.openAt(ref('John 15:4'), 'web')
    await model.selectVerse(verse4)
    const member = model.view.details[verse4].crossReferences[0].members[0]

    await model.openAt(member.reference, null)
    await model.selectVerse(makeVerseId(19, 80, 8))

    expect(model.view.position).toEqual({ book: 19, chapter: 80 })
    const details = model.view.details[makeVerseId(19, 80, 8)]
    expect(details.crossReferences.map((entry) => entry.id)).toEqual(['xr-vine'])
    expect(details.crossReferences[0].members.map((m) => m.label)).toEqual([
      'John 15:1-8',
      'Romans 11:17-24',
    ])
  })

  it('surfaces identically in any viewed translation', async () => {
    const model = modelWith({
      passages: passageSourceOver(psalmTexts()),
      availableTranslations: async () => [translation('web'), translation('kjv')],
      crossReferences: storeOf(vineCrossReference),
    })
    await model.openAt(ref('John 15:4'), 'web')
    await model.selectVerse(verse4)
    const surfacedInWeb = model.view.details[verse4].crossReferences

    await model.setTranslation('kjv')
    await model.selectVerse(verse4)

    expect(model.view.details[verse4].crossReferences).toEqual(surfacedInWeb)
    expect(surfacedInWeb.map((entry) => entry.id)).toEqual(['xr-vine'])
  })
})

describe('cross-references intersecting the viewed chapter', () => {
  const vineCrossReference: CrossReference = {
    id: 'xr-vine',
    members: [ref('John 15:1-8'), ref('Psalm 80:8-16'), ref('Romans 11:17-24')],
    description: 'Vine and vineyard imagery for Israel',
  }
  const storeOver = (entries: () => CrossReference[]): CrossReferenceEditing =>
    crossReferencesOf({
      intersecting: (reference) =>
        entries().filter((entry) =>
          entry.members.some((member) => referencesIntersect(member, reference)),
        ),
    })

  it('lists the chapter\'s cross-references with no verse selected', async () => {
    const model = modelWith({
      crossReferences: storeOver(() => [vineCrossReference]),
    })

    await model.openAt(ref('John 15:4'), 'web')

    expect(model.view.selectedVerseId).toBe(null)
    expect(model.view.chapterCrossReferences).toEqual([
      {
        id: 'xr-vine',
        description: 'Vine and vineyard imagery for Israel',
        members: [
          { label: 'Psalms 80:8-16', reference: ref('Psalm 80:8-16'), index: 1 },
          { label: 'Romans 11:17-24', reference: ref('Romans 11:17-24'), index: 2 },
        ],
        allMembers: vineCrossReference.members,
      },
    ])
  })

  it('leaves cross-references touching no verse of the chapter out', async () => {
    const elsewhere: CrossReference = {
      id: 'xr-elsewhere',
      members: [ref('Psalm 23:1'), ref('Romans 8:1')],
      description: null,
    }
    const model = modelWith({
      crossReferences: storeOver(() => [vineCrossReference, elsewhere]),
    })

    await model.openAt(ref('John 15:4'), 'web')

    expect(model.view.chapterCrossReferences.map((entry) => entry.id)).toEqual([
      'xr-vine',
    ])
  })

  it('re-scopes to the chapter navigated to', async () => {
    const nextChapter: CrossReference = {
      id: 'xr-next',
      members: [ref('John 16:1'), ref('Psalm 23:1')],
      description: null,
    }
    const model = modelWith({
      crossReferences: storeOver(() => [vineCrossReference, nextChapter]),
    })
    await model.openAt(ref('John 15:4'), 'web')

    await model.nextChapter()

    expect(model.view.chapterCrossReferences).toEqual([
      {
        id: 'xr-next',
        description: null,
        members: [{ label: 'Psalms 23:1', reference: ref('Psalm 23:1'), index: 1 }],
        allMembers: nextChapter.members,
      },
    ])
  })

  it('updates live when the cross-reference store changes', async () => {
    let entries: CrossReference[] = []
    const model = modelWith({ crossReferences: storeOver(() => entries) })
    await model.openAt(ref('John 15:4'), 'web')
    expect(model.view.chapterCrossReferences).toEqual([])
    let notified = 0
    model.subscribe(() => {
      notified += 1
    })

    entries = [vineCrossReference]
    await model.refreshOccurrences()

    expect(model.view.chapterCrossReferences.map((entry) => entry.id)).toEqual([
      'xr-vine',
    ])
    expect(notified).toBeGreaterThan(0)
  })
})

describe('translation availability in the reader', () => {
  it('shows an unavailable stacked row for a translation without content', async () => {
    const model = modelWith({
      availableTranslations: async () => [
        translation('web'),
        translation('nkjv'),
      ],
    })
    await model.openAt(ref('John 15:4'), 'web')

    await model.selectVerse(makeVerseId(43, 15, 4))

    const details = model.view.details[makeVerseId(43, 15, 4)]
    expect(details.translations).toEqual([
      {
        id: 'web',
        label: 'WEB',
        name: 'WEB Full Name',
        segments: [{ text: 'Remain in me.', redLetter: false }],
      },
      { id: 'nkjv', label: 'NKJV', name: 'NKJV Full Name', segments: null },
    ])
  })

  it('refreshes the pill list in place when available translations change', async () => {
    let available = [translation('web')]
    const model = modelWith({
      availableTranslations: async () => available,
    })
    await model.openAt(ref('John 15:4'), 'web')
    expect(model.view.translations.map(({ id }) => id)).toEqual(['web'])

    available = [translation('web'), translation('nkjv')]
    await model.refreshTranslations()

    const view = model.view
    expect(view.translations).toEqual([
      { id: 'web', label: 'WEB', name: 'WEB Full Name', active: true },
      { id: 'nkjv', label: 'NKJV', name: 'NKJV Full Name', active: false },
    ])
    expect(view.rows).toHaveLength(5)
    expect(view.rows[0].segments[0].text).toBe('I am the true vine.')
  })
})

const addTyped = (model: ReaderPaneModel, text: string): void => {
  model.typeMember(text)
  model.addTypedReferenceToCollection()
}

describe('collecting a cross-reference', () => {
  const verse2 = makeVerseId(43, 15, 2)
  const verse4 = makeVerseId(43, 15, 4)

  const collectingModel = async (
    crossReferences: Partial<CrossReferenceEditing> = {},
    overrides: Partial<ReaderPaneDeps> = {},
  ): Promise<ReaderPaneModel> => {
    const model = modelWith({
      crossReferences: crossReferencesOf(crossReferences),
      ...overrides,
    })
    await model.openAt(ref('John 15:1'), 'web')
    model.startCollecting()
    return model
  }

  const gathered = (model: ReaderPaneModel): string[] =>
    model.view.collection?.members.map((member) => member.label) ?? []

  it('starts idle with no basket', async () => {
    const model = modelWith()
    await model.openAt(ref('John 15:1'), 'web')

    expect(model.view.collection).toBe(null)
  })

  it('opens an empty basket when collection starts', async () => {
    const model = await collectingModel()

    expect(model.view.collection).toEqual({
      members: [],
      canAddSelection: false,
      canSave: false,
      error: null,
      editing: false,
      confirmingDelete: false,
      description: '',
      typedMember: '',
    })
  })

  it('adds the current verse selection as a member and clears the selection', async () => {
    const model = await collectingModel()
    await model.selectVerse(verse4)
    expect(model.view.collection?.canAddSelection).toBe(true)

    model.addSelectionToCollection()

    expect(model.view.collection?.members).toEqual([
      { label: 'John 15:4', reference: ref('John 15:4'), index: 0 },
    ])
    expect(model.view.selectedVerseId).toBe(null)
    expect(model.selectionReference()).toBe(null)
    expect(model.view.collection?.canAddSelection).toBe(false)
  })

  it('adds an extended selection span as one member', async () => {
    const model = await collectingModel()
    await model.selectVerse(verse2)
    model.extendSelectionTo(verse4)

    model.addSelectionToCollection()

    expect(gathered(model)).toEqual(['John 15:2-4'])
  })

  it('ignores add-selection with nothing selected', async () => {
    const model = await collectingModel()

    model.addSelectionToCollection()

    expect(gathered(model)).toEqual([])
  })

  it('adds a typed reference parsed with the reference grammar', async () => {
    const model = await collectingModel()

    addTyped(model, 'Psalm 80:8-16')

    expect(model.view.collection?.members).toEqual([
      { label: 'Psalms 80:8-16', reference: ref('Psalm 80:8-16'), index: 0 },
    ])
    expect(model.view.collection?.error).toBe(null)
  })

  it('clears the typed draft once its reference lands in the basket', async () => {
    const model = await collectingModel()
    model.typeMember('Psalm 80:8-16')

    model.addTypedReferenceToCollection()

    expect(model.view.collection?.typedMember).toBe('')
  })

  it('keeps a rejected typed draft so it can be corrected', async () => {
    const model = await collectingModel()
    model.typeMember('Hezekiah 4:12')

    model.addTypedReferenceToCollection()

    expect(model.view.collection?.typedMember).toBe('Hezekiah 4:12')
  })

  it('keeps a blank draft out of the basket', async () => {
    const model = await collectingModel()
    model.typeMember('   ')

    model.addTypedReferenceToCollection()

    expect(gathered(model)).toEqual([])
    expect(model.view.collection?.error).toBe(null)
  })

  it('starts a fresh basket with an empty typed draft', async () => {
    const model = await collectingModel()
    model.typeMember('Psalm 80')
    model.cancelCollecting()

    model.startCollecting()

    expect(model.view.collection?.typedMember).toBe('')
  })

  it('rejects unparseable typed input visibly and leaves the basket untouched', async () => {
    const model = await collectingModel()
    addTyped(model, 'Psalm 80:8-16')

    addTyped(model, 'Hezekiah 4:12')

    expect(gathered(model)).toEqual(['Psalms 80:8-16'])
    expect(model.view.collection?.error).toBe(
      'Hezekiah 4:12 is not a reference.',
    )
  })

  it('clears the rejection when a reference is added', async () => {
    const model = await collectingModel()
    addTyped(model, 'nonsense')

    addTyped(model, 'Psalm 80:8-16')

    expect(model.view.collection?.error).toBe(null)
  })

  it('removes a gathered member', async () => {
    const model = await collectingModel()
    addTyped(model, 'Psalm 80:8-16')
    addTyped(model, 'Romans 11:17-24')

    model.removeCollectionMember(0)

    expect(gathered(model)).toEqual(['Romans 11:17-24'])
  })

  it('keeps the basket across book, chapter and translation navigation', async () => {
    const model = await collectingModel(
      {},
      {
        availableTranslations: async () => [
          translation('web'),
          translation('kjv'),
        ],
      },
    )
    addTyped(model, 'Psalm 80:8-16')

    await model.goTo(43, 15)
    await model.nextChapter()
    await model.setTranslation('kjv')

    expect(gathered(model)).toEqual(['Psalms 80:8-16'])
  })

  it('discards the basket on cancel', async () => {
    const model = await collectingModel()
    addTyped(model, 'Psalm 80:8-16')

    model.cancelCollecting()

    expect(model.view.collection).toBe(null)
  })

  it('gates saving below two members', async () => {
    const model = await collectingModel()
    addTyped(model, 'Psalm 80:8-16')
    expect(model.view.collection?.canSave).toBe(false)

    addTyped(model, 'Romans 11:17-24')

    expect(model.view.collection?.canSave).toBe(true)
  })

  it('persists the gathered members with the description in one step', async () => {
    const created: { members: Reference[]; description: string | null }[] = []
    const model = await collectingModel({
      create: async (members, description) => {
        created.push({ members, description })
      },
    })
    await model.selectVerse(verse4)
    model.addSelectionToCollection()
    addTyped(model, 'Psalm 80:8-16')

    model.describeCollection('Vine imagery')
    await model.saveCrossReference()

    expect(created).toEqual([
      {
        members: [ref('John 15:4'), ref('Psalm 80:8-16')],
        description: 'Vine imagery',
      },
    ])
    expect(model.view.collection).toBe(null)
  })

  it('persists a blank description as none', async () => {
    const created: (string | null)[] = []
    const model = await collectingModel({
      create: async (_members, description) => {
        created.push(description)
      },
    })
    addTyped(model, 'Psalm 80:8-16')
    addTyped(model, 'Romans 11:17-24')

    model.describeCollection('   ')
    await model.saveCrossReference()

    expect(created).toEqual([null])
  })

  it('refuses to save below two members and keeps the strip open', async () => {
    let creates = 0
    const model = await collectingModel({
      create: async () => {
        creates++
      },
    })
    addTyped(model, 'Psalm 80:8-16')

    await model.saveCrossReference()

    expect(creates).toBe(0)
    expect(model.view.collection?.members).toHaveLength(1)
  })

  it('surfaces the created cross-reference in open details at once', async () => {
    const stored: CrossReference[] = []
    const model = await collectingModel({
      intersecting: (reference) =>
        stored.filter((entry) =>
          entry.members.some((member) => referencesIntersect(member, reference)),
        ),
      create: async (members, description) => {
        stored.push({ id: 'xr-created', members, description })
      },
    })
    await model.selectVerse(verse4)
    model.addSelectionToCollection()
    addTyped(model, 'Psalm 80:8-16')
    await model.selectVerse(verse4)
    expect(model.view.details[verse4].crossReferences).toEqual([])

    await model.saveCrossReference()

    expect(model.view.details[verse4].crossReferences).toEqual([
      {
        id: 'xr-created',
        description: null,
        members: [
          { label: 'Psalms 80:8-16', reference: ref('Psalm 80:8-16'), index: 1 },
        ],
        allMembers: [ref('John 15:4'), ref('Psalm 80:8-16')],
      },
    ])
  })
})

describe('editing an existing cross-reference in the strip', () => {
  const vine: CrossReference = {
    id: 'xr-vine',
    members: [ref('John 15:1-8'), ref('Psalm 80:8-16'), ref('Romans 11:17-24')],
    description: 'Vine and vineyard imagery for Israel',
  }

  const gathered = (model: ReaderPaneModel): string[] =>
    model.view.collection?.members.map((member) => member.label) ?? []

  const editingModel = async (
    crossReferences: Partial<CrossReferenceEditing> = {},
  ): Promise<ReaderPaneModel> => {
    const model = modelWith({
      crossReferences: crossReferencesOf(crossReferences),
    })
    await model.openAt(ref('John 15:1'), 'web')
    model.startEditingCrossReference(vine)
    return model
  }

  it('opens the strip pre-loaded with the entry\'s members and description', async () => {
    const model = await editingModel()

    expect(model.view.collection).toEqual({
      members: [
        { label: 'John 15:1-8', reference: ref('John 15:1-8'), index: 0 },
        { label: 'Psalms 80:8-16', reference: ref('Psalm 80:8-16'), index: 1 },
        { label: 'Romans 11:17-24', reference: ref('Romans 11:17-24'), index: 2 },
      ],
      canAddSelection: false,
      canSave: true,
      error: null,
      editing: true,
      confirmingDelete: false,
      description: 'Vine and vineyard imagery for Israel',
      typedMember: '',
    })
  })

  it('gathers exactly as creation does: selection, typed entry, and removal of a pre-loaded member', async () => {
    const model = await editingModel()

    await model.selectVerse(makeVerseId(43, 15, 4))
    model.addSelectionToCollection()
    addTyped(model, 'Psalm 23:1')
    model.removeCollectionMember(1)

    expect(gathered(model)).toEqual([
      'John 15:1-8',
      'Romans 11:17-24',
      'John 15:4',
      'Psalms 23:1',
    ])
  })

  it('saves the edited members and description back to the same id in one update', async () => {
    const updates: {
      id: string
      members: Reference[]
      description: string | null
    }[] = []
    const model = await editingModel({
      update: async (id, members, description) => {
        updates.push({ id, members, description })
      },
    })
    addTyped(model, 'Psalm 23:1')

    await model.saveCrossReference()

    expect(updates).toEqual([
      {
        id: 'xr-vine',
        members: [...vine.members, ref('Psalm 23:1')],
        description: 'Vine and vineyard imagery for Israel',
      },
    ])
    expect(model.view.collection).toBe(null)
  })

  it('saves an edited description over the existing one', async () => {
    const descriptions: (string | null)[] = []
    const model = await editingModel({
      update: async (_id, _members, description) => {
        descriptions.push(description)
      },
    })

    model.describeCollection('Grafted branches')
    await model.saveCrossReference()

    expect(descriptions).toEqual(['Grafted branches'])
  })

  it('refuses to edit while another basket is in progress', async () => {
    const model = modelWith()
    await model.openAt(ref('John 15:1'), 'web')
    model.startCollecting()
    addTyped(model, 'Psalm 23:1')

    model.startEditingCrossReference(vine)

    expect(gathered(model)).toEqual(['Psalms 23:1'])
    expect(model.view.collection?.editing).toBe(false)
  })

  it('does not touch the store on cancel', async () => {
    let updates = 0
    const model = await editingModel({
      update: async () => {
        updates++
      },
    })
    addTyped(model, 'Psalm 23:1')
    model.removeCollectionMember(0)

    model.cancelCollecting()

    expect(model.view.collection).toBe(null)
    expect(updates).toBe(0)
  })

  it('gates saving below two members after pruning the strip', async () => {
    const model = await editingModel()

    model.removeCollectionMember(2)
    model.removeCollectionMember(1)

    expect(model.view.collection?.canSave).toBe(false)

    let updates = 0
    const guarded = modelWith({
      crossReferences: crossReferencesOf({
        update: async () => {
          updates++
        },
      }),
    })
    await guarded.openAt(ref('John 15:1'), 'web')
    guarded.startEditingCrossReference({ ...vine, members: [vine.members[0]] })
    await guarded.saveCrossReference()

    expect(updates).toBe(0)
  })

  it('does not carry editing state into a fresh collection', async () => {
    const model = await editingModel()
    model.cancelCollecting()

    model.startCollecting()

    expect(model.view.collection?.editing).toBe(false)
  })

  it('asks for confirmation before deleting, and cancel backs out', async () => {
    const model = await editingModel()

    model.confirmDeleteCrossReference()
    expect(model.view.collection?.confirmingDelete).toBe(true)

    model.cancelDeleteCrossReference()
    expect(model.view.collection?.confirmingDelete).toBe(false)
  })

  it('deletes the edited cross-reference and closes the strip', async () => {
    const deleted: string[] = []
    let entries: CrossReference[] = [vine]
    const model = await editingModel({
      intersecting: (reference) =>
        entries.filter((entry) =>
          entry.members.some((member) => referencesIntersect(member, reference)),
        ),
      delete: async (id) => {
        deleted.push(id)
        entries = entries.filter((entry) => entry.id !== id)
      },
    })

    model.confirmDeleteCrossReference()
    await model.deleteCrossReference()

    expect(deleted).toEqual(['xr-vine'])
    expect(model.view.collection).toBe(null)
    expect(model.view.chapterCrossReferences).toEqual([])
  })

  it('ignores delete while creating a new cross-reference', async () => {
    let deletes = 0
    const model = modelWith({
      crossReferences: crossReferencesOf({
        delete: async () => {
          deletes++
        },
      }),
    })
    await model.openAt(ref('John 15:1'), 'web')
    model.startCollecting()

    model.confirmDeleteCrossReference()
    await model.deleteCrossReference()

    expect(deletes).toBe(0)
    expect(model.view.collection).not.toBe(null)
  })
})
