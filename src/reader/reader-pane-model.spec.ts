import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  deregisterBook,
  deregisterBookVersification,
  enumerateVerseIds,
  makeVerseId,
  parseReference,
  rangeContains,
  referencesIntersect,
  registerBook,
  registerBookVersification,
  type Reference,
  type RegisteredBook,
} from '../reference'
import type { Epigraph } from '../modules'
import type { Passage, PassageSource } from '../rendering'
import type {
  CrossReference,
  CrossReferenceEditing,
} from '../cross-references'
import type { OccurrenceGroup } from '../vault-index'
import type { StudyMaterialSource, VerseDetailsView } from '../contracts'
import {
  paragraphsOf,
  ReaderPaneModel,
  type ReaderBook,
  type ReaderBookSection,
  type ReaderBookSource,
  type ReaderPaneDeps,
  type ReaderPosition,
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
  nav: 'tree',
  layout: 'verse-per-line',
  strongs: 'off',
  redLetter: 'off',
  paraNumbers: 'hover',
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

// Captures what the copy action would put on the system clipboard, so specs
// never touch the real one.
const fakeClipboard = (): {
  writeText: (text: string) => Promise<void>
  copied: string[]
} => {
  const copied: string[] = []
  return {
    copied,
    writeText: async (text: string) => {
      copied.push(text)
    },
  }
}

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

// An annotation group carries its frontmatter reference first; a mention
// group (frontmatter null) holds body occurrences only.
const group = (
  file: string,
  frontmatter: string | null,
  ...body: string[]
): OccurrenceGroup => ({
  file,
  annotationReference: frontmatter === null ? null : ref(frontmatter),
  occurrences: [...(frontmatter === null ? [] : [frontmatter]), ...body].map(
    (text, position) => ({
      file,
      position,
      reference: ref(text),
      source:
        frontmatter !== null && position === 0
          ? ('annotation-frontmatter' as const)
          : ('body' as const),
    }),
  ),
})

const detailsOf = (model: ReaderPaneModel): VerseDetailsView => {
  const details = model.studyMaterial.details
  if (details === null) throw new Error('no verse details loaded')
  return details
}

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

describe('book tree expansion', () => {
  const openJohn15 = async (): Promise<ReaderPaneModel> => {
    const model = modelWith()
    await model.openAt(ref('John 15:4'), 'web')
    return model
  }

  it("expands the reader's own book until one is browsed", async () => {
    const model = await openJohn15()

    expect(model.view.treeBook).toBe(43)
  })

  it('keeps a browsed book expanded while the reader stays in its own book', async () => {
    const model = await openJohn15()

    model.browseBook(10)
    await model.nextChapter()

    expect(model.view.treeBook).toBe(10)
  })

  it("follows the reader as soon as the reader's book changes", async () => {
    const model = await openJohn15()

    model.browseBook(10)
    await model.goTo(43, 21)
    await model.nextChapter()

    expect(model.view.treeBook).toBe(44)
  })

  it('follows a position replayed from history or a layout restore', async () => {
    const model = await openJohn15()

    model.browseBook(10)
    await model.openPosition({ book: 1, chapter: 1 })

    expect(model.view.treeBook).toBe(1)
  })

  it('follows a reference opened into the pane', async () => {
    const model = await openJohn15()

    model.browseBook(10)
    await model.openAt(ref('Genesis 1:1'), 'web')

    expect(model.view.treeBook).toBe(1)
  })

  it('collapses a browsed book when it is picked again', async () => {
    const model = await openJohn15()

    model.browseBook(10)
    model.browseBook(10)

    expect(model.view.treeBook).toBe(43)
  })

  it('notifies subscribers when the browsed book changes', async () => {
    const model = await openJohn15()
    let notified = 0
    model.subscribe(() => notified++)

    model.browseBook(10)

    expect(notified).toBe(1)
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
  const verse2 = makeVerseId(43, 15, 2)
  const verse4 = makeVerseId(43, 15, 4)
  const twoTranslations = (): Partial<ReaderPaneDeps> => ({
    passages: passageSourceOver({
      ...john15Texts(),
      kjv: { [makeVerseId(43, 15, 1)]: 'I am the true vine (KJV).' },
    }),
    availableTranslations: async () => [translation('web'), translation('kjv')],
  })

  it('loads the clicked verse with every installed translation stacked', async () => {
    const model = modelWith(twoTranslations())
    model.setDetailsWanted(true)
    await model.openAt(ref('John 15:4'), 'web')

    await model.selectVerse(verse4)

    expect(detailsOf(model)).toEqual({
      verseId: verse4,
      title: 'John 15:4',
      book: null,
      translations: [
        {
          id: 'web',
          label: 'WEB',
          name: 'WEB Full Name',
          segments: [{ text: 'Remain in me.', redLetter: false }],
        },
        { id: 'kjv', label: 'KJV', name: 'KJV Full Name', segments: null },
      ],
      strongs: [],
      strongsAttribution: null,
    })
  })

  it('loads no details while no surface wants them', async () => {
    const detailLoads: Reference[] = []
    const model = modelWith({
      passages: {
        passage: async (reference, translationId) => {
          if (reference.ranges[0].startId === reference.ranges[0].endId)
            detailLoads.push(reference)
          return passageSourceOver(john15Texts()).passage(
            reference,
            translationId,
          )
        },
      },
    })
    await model.openAt(ref('John 15:4'), 'web')

    await model.selectVerse(verse4)
    await flushAsync()

    expect(model.studyMaterial.selectedVerseId).toBe(verse4)
    expect(model.studyMaterial.details).toBe(null)
    expect(detailLoads).toEqual([])
  })

  it('loads the current selection the moment details become wanted', async () => {
    const model = modelWith(twoTranslations())
    await model.openAt(ref('John 15:4'), 'web')
    await model.selectVerse(verse4)

    model.setDetailsWanted(true)
    await flushAsync()

    expect(detailsOf(model).title).toBe('John 15:4')
  })

  it('loads the whole extended selection into every translation', async () => {
    const model = modelWith(twoTranslations())
    model.setDetailsWanted(true)
    await model.openAt(ref('John 15:2'), 'web')

    await model.selectVerse(verse2)
    model.extendSelectionTo(verse4)
    await flushAsync()

    const details = detailsOf(model)
    expect(details.title).toBe('John 15:2-4')
    expect(
      details.translations[0].segments?.map((segment) => segment.text).join(''),
    ).toBe('Every branch in me. You are already pruned. Remain in me.')
  })

  it('refreshes the details as the selection changes while they are wanted', async () => {
    const model = modelWith(twoTranslations())
    model.setDetailsWanted(true)
    await model.openAt(ref('John 15:4'), 'web')
    await model.selectVerse(verse4)

    await model.selectVerse(verse2)
    await flushAsync()

    expect(detailsOf(model).title).toBe('John 15:2')
  })

  it('deselects the verse and drops its details when clicked again', async () => {
    const model = modelWith(twoTranslations())
    model.setDetailsWanted(true)
    await model.openAt(ref('John 15:4'), 'web')

    await model.selectVerse(verse4)
    await model.selectVerse(verse4)

    expect(model.studyMaterial.selectedVerseId).toBe(null)
    expect(model.studyMaterial.details).toBe(null)
  })

  it('collapses an extended selection to its anchor when the anchor is clicked', async () => {
    const model = modelWith(twoTranslations())
    await model.openAt(ref('John 15:4'), 'web')

    await model.selectVerse(verse4)
    model.extendSelectionTo(makeVerseId(43, 15, 2))
    await model.selectVerse(verse4)

    expect(model.studyMaterial.selectedVerseId).toBe(verse4)
    expect(model.studyMaterial.selectionEndId).toBe(null)
  })

  it('clears the selection and its details on the clear action', async () => {
    const model = modelWith(twoTranslations())
    model.setDetailsWanted(true)
    await model.openAt(ref('John 15:4'), 'web')
    await model.selectVerse(verse4)

    model.clearSelection()

    expect(model.studyMaterial.selectedVerseId).toBe(null)
    expect(model.studyMaterial.selectionEndId).toBe(null)
    expect(model.studyMaterial.details).toBe(null)
    expect(model.selectionReference()).toBe(null)
  })

  it('drops the previous verse details the moment another verse is clicked', async () => {
    const model = modelWith(twoTranslations())
    model.setDetailsWanted(true)
    await model.openAt(ref('John 15:4'), 'web')
    await model.selectVerse(verse4)

    const selecting = model.selectVerse(makeVerseId(43, 15, 5))

    expect(model.studyMaterial.details).toBe(null)
    await selecting
    expect(detailsOf(model).verseId).toBe(makeVerseId(43, 15, 5))
  })
})

describe('copying the selection as a formatted reference', () => {
  it('copies the single verse as a paste-ready reference', async () => {
    const clipboard = fakeClipboard()
    const model = modelWith({ clipboard })
    await model.openAt(ref('John 15:4'), 'web')
    await model.selectVerse(makeVerseId(43, 15, 4))

    await model.copyFormattedReference()

    expect(clipboard.copied).toEqual(['{John 15:4}'])
  })

  it('copies an extended selection as one span', async () => {
    const clipboard = fakeClipboard()
    const model = modelWith({ clipboard })
    await model.openAt(ref('John 15:2'), 'web')
    await model.selectVerse(makeVerseId(43, 15, 2))
    model.extendSelectionTo(makeVerseId(43, 15, 4))

    await model.copyFormattedReference()

    expect(clipboard.copied).toEqual(['{John 15:2-4}'])
  })

  it('copies nothing while no verse is selected', async () => {
    const clipboard = fakeClipboard()
    const model = modelWith({ clipboard })
    await model.openAt(ref('John 15:1'), 'web')

    await model.copyFormattedReference()

    expect(clipboard.copied).toEqual([])
  })
})

describe('verse indicators', () => {
  const chapterQueried = (
    groups: OccurrenceGroup[],
  ): ((reference: Reference) => OccurrenceGroup[]) => {
    const chapterStart = makeVerseId(43, 15, 1)
    return (reference) =>
      reference.ranges.some((range) => range.startId === chapterStart)
        ? groups
        : []
  }

  it('marks verses with annotation and intersecting-note counts', async () => {
    const model = modelWith({
      intersecting: chapterQueried([
        group('Annotations/John 15.4.md', 'John 15:4'),
        group('Sermons/Fruitfulness.md', null, 'John 15:4'),
        group('Topics/Union.md', null, 'John 15:4'),
      ]),
    })

    await model.openAt(ref('John 15:4'), 'web')

    const rows = model.view.rows
    expect(rows[3].annotations).toBe(1)
    expect(rows[3].mentions).toBe(2)
    expect(rows[0].annotations).toBe(0)
    expect(rows[0].mentions).toBe(0)
  })

  it('marks only the first verse of a range, not every covered verse', async () => {
    const model = modelWith({
      intersecting: chapterQueried([
        group('Annotations/Abiding.md', 'John 15:2-5'),
      ]),
    })

    await model.openAt(ref('John 15:2'), 'web')

    expect(model.view.rows.map((row) => row.annotations)).toEqual([
      0, 1, 0, 0, 0,
    ])
  })

  it('marks the chapter opening for a range entering from the previous chapter', async () => {
    const model = modelWith({
      intersecting: chapterQueried([
        group('Sermons/Farewell.md', null, 'John 14:30-15:3'),
      ]),
    })

    await model.openAt(ref('John 15:1'), 'web')

    expect(model.view.rows.map((row) => row.mentions)).toEqual([1, 0, 0, 0, 0])
  })

  it('marks each range of a multi-range reference', async () => {
    const model = modelWith({
      intersecting: chapterQueried([
        group('Sermons/Fruit.md', null, 'John 15:1-2,4-5'),
      ]),
    })

    await model.openAt(ref('John 15:1'), 'web')

    expect(model.view.rows.map((row) => row.mentions)).toEqual([1, 0, 0, 1, 0])
  })

  it('counts annotations starting a range at the same verse', async () => {
    const model = modelWith({
      intersecting: chapterQueried([
        group('Annotations/a.md', 'John 15:4'),
        group('Annotations/b.md', 'John 15:4-5'),
      ]),
    })

    await model.openAt(ref('John 15:4'), 'web')

    expect(model.view.rows[3].annotations).toBe(2)
  })

  it('counts mentions per distinct note', async () => {
    const model = modelWith({
      intersecting: chapterQueried([
        group('Sermons/Vine.md', null, 'John 15:4', 'John 15:4-6'),
      ]),
    })

    await model.openAt(ref('John 15:4'), 'web')

    expect(model.view.rows[3].mentions).toBe(1)
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
    expect(model.studyMaterial.selectionEndId).toBe(verse2)
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
  it('re-counts indicators from the index', async () => {
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

    groups = [group('Annotations/John 15.4.md', 'John 15:4')]
    await model.refreshOccurrences()

    expect(model.view.rows[3].annotations).toBe(1)
  })

  it('leaves the loaded verse details alone', async () => {
    const verse4 = makeVerseId(43, 15, 4)
    const detailLoads: number[] = []
    const model = modelWith({
      passages: {
        passage: async (reference, translationId) => {
          if (reference.ranges[0].startId === reference.ranges[0].endId)
            detailLoads.push(reference.ranges[0].startId)
          return passageSourceOver(john15Texts()).passage(
            reference,
            translationId,
          )
        },
      },
    })
    model.setDetailsWanted(true)
    await model.openAt(ref('John 15:4'), 'web')
    await model.selectVerse(verse4)
    detailLoads.length = 0

    await model.refreshOccurrences()

    expect(detailLoads).toEqual([])
    expect(detailsOf(model).verseId).toBe(verse4)
  })
})

describe('reader toggles', () => {
  it('seeds the toggles from the configured defaults', () => {
    const model = modelWith({}, {
      nav: 'breadcrumb',
      layout: 'continuous',
      strongs: 'on',
      redLetter: 'on',
      paraNumbers: 'on',
    })

    expect(model.view.toggles).toEqual({
      nav: 'breadcrumb',
      layout: 'continuous',
      strongs: 'on',
      redLetter: 'on',
      paraNumbers: 'on',
    })
  })

  it('switches each toggle independently and notifies subscribers', () => {
    const model = modelWith()
    let notified = 0
    model.subscribe(() => notified++)

    model.setToggle('nav', 'breadcrumb')
    model.setToggle('layout', 'continuous')

    expect(model.view.toggles).toEqual({
      nav: 'breadcrumb',
      layout: 'continuous',
      strongs: 'off',
      redLetter: 'off',
      paraNumbers: 'hover',
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
    model.setDetailsWanted(true)
    await model.openPosition({ book: 43, chapter: 15 })
    return model
  }

  it('renders dictionary entries for a tapped word in tag order with attribution', async () => {
    const model = await openedModel()
    const verseId = makeVerseId(43, 15, 4)

    await model.selectWord(verseId, ['G3306', 'G1722'])

    const details = detailsOf(model)
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
      detailsOf(model).strongs.map((entry) => entry.strongs),
    ).toEqual(['G2222'])
  })

  it('keeps a plain verse selection free of dictionary entries', async () => {
    const model = await openedModel()
    const verseId = makeVerseId(43, 15, 4)
    await model.selectWord(verseId, ['G3306'])
    await model.selectVerse(verseId)

    await model.selectVerse(verseId)

    expect(detailsOf(model).strongs).toEqual([])
    expect(detailsOf(model).strongsAttribution).toBe(null)
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

  it('lists every member, the viewed chapter\'s included', async () => {
    const model = modelWith({
      crossReferences: storeOver(() => [vineCrossReference]),
    })

    await model.openAt(ref('John 15:4'), 'web')

    expect(model.studyMaterial.selectedVerseId).toBe(null)
    expect(model.studyMaterial.chapterCrossReferences).toEqual([
      {
        id: 'xr-vine',
        description: 'Vine and vineyard imagery for Israel',
        members: [
          { label: 'John 15:1-8', reference: ref('John 15:1-8'), index: 0 },
          { label: 'Psalms 80:8-16', reference: ref('Psalm 80:8-16'), index: 1 },
          { label: 'Romans 11:17-24', reference: ref('Romans 11:17-24'), index: 2 },
        ],
        allMembers: vineCrossReference.members,
      },
    ])
  })

  it('leads with the member intersecting the viewed chapter', async () => {
    const abiding: CrossReference = {
      id: 'xr-abiding',
      members: [ref('John 8:31-32'), ref('John 15:7-8')],
      description: null,
    }
    const model = modelWith({ crossReferences: storeOver(() => [abiding]) })

    await model.openAt(ref('John 15:4'), 'web')

    expect(
      model.studyMaterial.chapterCrossReferences[0].members.map((member) => member.label),
    ).toEqual(['John 15:7-8', 'John 8:31-32'])
  })

  it('orders members intersecting the chapter by start verse', async () => {
    const branches: CrossReference = {
      id: 'xr-branches',
      members: [ref('Psalm 80:8-16'), ref('John 15:1-2'), ref('John 15:7-8')],
      description: null,
    }
    const model = modelWith({ crossReferences: storeOver(() => [branches]) })

    await model.openAt(ref('John 15:4'), 'web')

    expect(
      model.studyMaterial.chapterCrossReferences[0].members.map((member) => ({
        label: member.label,
        index: member.index,
      })),
    ).toEqual([
      { label: 'John 15:1-2', index: 1 },
      { label: 'John 15:7-8', index: 2 },
      { label: 'Psalms 80:8-16', index: 0 },
    ])
  })

  it('orders members elsewhere by book and start verse', async () => {
    const shuffled: CrossReference = {
      id: 'xr-vine',
      members: [
        ref('Romans 11:17-24'),
        ref('John 15:1-8'),
        ref('Psalm 80:8-16'),
      ],
      description: null,
    }
    const model = modelWith({ crossReferences: storeOver(() => [shuffled]) })

    await model.openAt(ref('John 15:4'), 'web')

    expect(
      model.studyMaterial.chapterCrossReferences[0].members.map((member) => member.label),
    ).toEqual(['John 15:1-8', 'Psalms 80:8-16', 'Romans 11:17-24'])
  })

  it('orders cross-references by their leading member', async () => {
    const later: CrossReference = {
      id: 'xr-later',
      members: [ref('John 15:22-25'), ref('Deuteronomy 9:2-5')],
      description: null,
    }
    const earlier: CrossReference = {
      id: 'xr-earlier',
      members: [ref('John 15:7-8'), ref('John 8:31-32')],
      description: null,
    }
    const away: CrossReference = {
      id: 'xr-away',
      members: [ref('John 15:1'), ref('Deuteronomy 9:2-5')],
      description: null,
    }
    const model = modelWith({
      crossReferences: storeOver(() => [later, earlier, away]),
    })

    await model.openAt(ref('John 15:4'), 'web')

    expect(model.studyMaterial.chapterCrossReferences.map((entry) => entry.id)).toEqual([
      'xr-away',
      'xr-earlier',
      'xr-later',
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

    expect(model.studyMaterial.chapterCrossReferences.map((entry) => entry.id)).toEqual([
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

    expect(model.studyMaterial.chapterCrossReferences).toEqual([
      {
        id: 'xr-next',
        description: null,
        members: [
          { label: 'John 16:1', reference: ref('John 16:1'), index: 0 },
          { label: 'Psalms 23:1', reference: ref('Psalm 23:1'), index: 1 },
        ],
        allMembers: nextChapter.members,
      },
    ])
  })

  it('updates live when the cross-reference store changes', async () => {
    let entries: CrossReference[] = []
    const model = modelWith({ crossReferences: storeOver(() => entries) })
    await model.openAt(ref('John 15:4'), 'web')
    expect(model.studyMaterial.chapterCrossReferences).toEqual([])
    let notified = 0
    model.subscribe(() => {
      notified += 1
    })

    entries = [vineCrossReference]
    await model.refreshOccurrences()

    expect(model.studyMaterial.chapterCrossReferences.map((entry) => entry.id)).toEqual([
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
    model.setDetailsWanted(true)
    await model.openAt(ref('John 15:4'), 'web')

    await model.selectVerse(makeVerseId(43, 15, 4))

    const details = detailsOf(model)
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
    model.studyMaterial.collection?.members.map((member) => member.label) ?? []

  it('starts idle with no basket', async () => {
    const model = modelWith()
    await model.openAt(ref('John 15:1'), 'web')

    expect(model.studyMaterial.collection).toBe(null)
  })

  it('opens an empty basket when collection starts', async () => {
    const model = await collectingModel()

    expect(model.studyMaterial.collection).toEqual({
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
    expect(model.studyMaterial.collection?.canAddSelection).toBe(true)

    model.addSelectionToCollection()

    expect(model.studyMaterial.collection?.members).toEqual([
      { label: 'John 15:4', reference: ref('John 15:4'), index: 0 },
    ])
    expect(model.studyMaterial.selectedVerseId).toBe(null)
    expect(model.selectionReference()).toBe(null)
    expect(model.studyMaterial.collection?.canAddSelection).toBe(false)
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

    expect(model.studyMaterial.collection?.members).toEqual([
      { label: 'Psalms 80:8-16', reference: ref('Psalm 80:8-16'), index: 0 },
    ])
    expect(model.studyMaterial.collection?.error).toBe(null)
  })

  it('clears the typed draft once its reference lands in the basket', async () => {
    const model = await collectingModel()
    model.typeMember('Psalm 80:8-16')

    model.addTypedReferenceToCollection()

    expect(model.studyMaterial.collection?.typedMember).toBe('')
  })

  it('keeps a rejected typed draft so it can be corrected', async () => {
    const model = await collectingModel()
    model.typeMember('Hezekiah 4:12')

    model.addTypedReferenceToCollection()

    expect(model.studyMaterial.collection?.typedMember).toBe('Hezekiah 4:12')
  })

  it('keeps a blank draft out of the basket', async () => {
    const model = await collectingModel()
    model.typeMember('   ')

    model.addTypedReferenceToCollection()

    expect(gathered(model)).toEqual([])
    expect(model.studyMaterial.collection?.error).toBe(null)
  })

  it('starts a fresh basket with an empty typed draft', async () => {
    const model = await collectingModel()
    model.typeMember('Psalm 80')
    model.cancelCollecting()

    model.startCollecting()

    expect(model.studyMaterial.collection?.typedMember).toBe('')
  })

  it('rejects unparseable typed input visibly and leaves the basket untouched', async () => {
    const model = await collectingModel()
    addTyped(model, 'Psalm 80:8-16')

    addTyped(model, 'Hezekiah 4:12')

    expect(gathered(model)).toEqual(['Psalms 80:8-16'])
    expect(model.studyMaterial.collection?.error).toBe(
      'Hezekiah 4:12 is not a reference.',
    )
  })

  it('clears the rejection when a reference is added', async () => {
    const model = await collectingModel()
    addTyped(model, 'nonsense')

    addTyped(model, 'Psalm 80:8-16')

    expect(model.studyMaterial.collection?.error).toBe(null)
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

    expect(model.studyMaterial.collection).toBe(null)
  })

  it('gates saving below two members', async () => {
    const model = await collectingModel()
    addTyped(model, 'Psalm 80:8-16')
    expect(model.studyMaterial.collection?.canSave).toBe(false)

    addTyped(model, 'Romans 11:17-24')

    expect(model.studyMaterial.collection?.canSave).toBe(true)
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
    expect(model.studyMaterial.collection).toBe(null)
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
    expect(model.studyMaterial.collection?.members).toHaveLength(1)
  })

  it('surfaces the created cross-reference in the chapter list at once', async () => {
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
    expect(model.studyMaterial.chapterCrossReferences).toEqual([])

    await model.saveCrossReference()

    expect(model.studyMaterial.chapterCrossReferences).toEqual([
      {
        id: 'xr-created',
        description: null,
        members: [
          { label: 'John 15:4', reference: ref('John 15:4'), index: 0 },
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
    model.studyMaterial.collection?.members.map((member) => member.label) ?? []

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

    expect(model.studyMaterial.collection).toEqual({
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
    expect(model.studyMaterial.collection).toBe(null)
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
    expect(model.studyMaterial.collection?.editing).toBe(false)
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

    expect(model.studyMaterial.collection).toBe(null)
    expect(updates).toBe(0)
  })

  it('gates saving below two members after pruning the strip', async () => {
    const model = await editingModel()

    model.removeCollectionMember(2)
    model.removeCollectionMember(1)

    expect(model.studyMaterial.collection?.canSave).toBe(false)

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

    expect(model.studyMaterial.collection?.editing).toBe(false)
  })

  it('asks for confirmation before deleting, and cancel backs out', async () => {
    const model = await editingModel()

    model.confirmDeleteCrossReference()
    expect(model.studyMaterial.collection?.confirmingDelete).toBe(true)

    model.cancelDeleteCrossReference()
    expect(model.studyMaterial.collection?.confirmingDelete).toBe(false)
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
    expect(model.studyMaterial.collection).toBe(null)
    expect(model.studyMaterial.chapterCrossReferences).toEqual([])
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
    expect(model.studyMaterial.collection).not.toBe(null)
  })
})

describe('the study material contract', () => {
  const verse2 = makeVerseId(43, 15, 2)
  const verse4 = makeVerseId(43, 15, 4)
  const verse5 = makeVerseId(43, 15, 5)

  // The pane is consumed as the contract alone — nothing below reaches for a
  // reader-only member.
  const sourceOf = (model: ReaderPaneModel): StudyMaterialSource => model

  it('offers no selection, details or collection before a verse is picked', async () => {
    const model = modelWith()
    await model.openAt(ref('John 15:1'), 'web')

    expect(sourceOf(model).studyMaterial).toEqual({
      title: 'John 15',
      bookMode: false,
      selectedVerseId: null,
      selectionEndId: null,
      details: null,
      chapterCrossReferences: [],
      chapterAnnotations: [],
      chapterMentions: [],
      collection: null,
    })
  })

  it('titles the material with the book and chapter on screen', async () => {
    const model = modelWith()
    await model.openAt(ref('John 15:1'), 'web')

    await model.nextChapter()

    expect(sourceOf(model).studyMaterial.title).toBe('John 16')
  })

  it('projects the selected verse, the span it extends over and its details', async () => {
    const model = modelWith()
    sourceOf(model).setDetailsWanted(true)
    await model.openAt(ref('John 15:1'), 'web')
    await model.selectVerse(verse2)
    model.extendSelectionTo(verse4)
    await flushAsync()

    const material = sourceOf(model).studyMaterial
    expect(material.selectedVerseId).toBe(verse2)
    expect(material.selectionEndId).toBe(verse4)
    expect(material.details?.title).toBe('John 15:2-4')
    expect(material.details?.translations.map((row) => row.id)).toEqual(['web'])
  })

  it('withholds the details of a verse whose load is still in flight', async () => {
    const model = modelWith()
    sourceOf(model).setDetailsWanted(true)
    await model.openAt(ref('John 15:1'), 'web')

    const selecting = model.selectVerse(verse4)

    expect(sourceOf(model).studyMaterial.selectedVerseId).toBe(verse4)
    expect(sourceOf(model).studyMaterial.details).toBe(null)
    await selecting
    expect(sourceOf(model).studyMaterial.details?.verseId).toBe(verse4)
  })

  it('lists the chapter cross-references with no verse selected', async () => {
    const vine: CrossReference = {
      id: 'xr-vine',
      members: [ref('John 15:1-8'), ref('Psalm 80:8-16')],
      description: 'Vine imagery',
    }
    const model = modelWith({
      crossReferences: crossReferencesOf({
        intersecting: (reference) =>
          [vine].filter((entry) =>
            entry.members.some((member) =>
              referencesIntersect(member, reference),
            ),
          ),
      }),
    })
    await model.openAt(ref('John 15:1'), 'web')

    const material = sourceOf(model).studyMaterial
    expect(material.selectedVerseId).toBe(null)
    expect(material.chapterCrossReferences.map((entry) => entry.id)).toEqual([
      'xr-vine',
    ])
  })

  it('collects and saves a cross-reference through the contract, notifying observers', async () => {
    const created: { members: Reference[]; description: string | null }[] = []
    const model = modelWith({
      crossReferences: crossReferencesOf({
        create: async (members, description) => {
          created.push({ members, description })
        },
      }),
    })
    await model.openAt(ref('John 15:1'), 'web')
    await model.selectVerse(verse5)
    const source = sourceOf(model)
    let notifications = 0
    const unsubscribe = source.subscribe(() => {
      notifications += 1
    })

    source.startCollecting()
    source.addSelectionToCollection()
    source.typeMember('Psalm 80:8')
    source.addTypedReferenceToCollection()
    source.describeCollection('Vine imagery')
    expect(
      source.studyMaterial.collection?.members.map((member) => member.label),
    ).toEqual(['John 15:5', 'Psalms 80:8'])
    expect(source.studyMaterial.collection?.canSave).toBe(true)
    await source.saveCrossReference()

    expect(created).toEqual([
      {
        members: [ref('John 15:5'), ref('Psalm 80:8')],
        description: 'Vine imagery',
      },
    ])
    expect(source.studyMaterial.collection).toBe(null)
    expect(notifications).toBeGreaterThan(0)
    unsubscribe()
  })

  it('opens the strip on an existing cross-reference and deletes it through the contract', async () => {
    const vine: CrossReference = {
      id: 'xr-vine',
      members: [ref('John 15:1'), ref('Psalm 80:8')],
      description: 'Vine imagery',
    }
    const deleted: string[] = []
    const model = modelWith({
      crossReferences: crossReferencesOf({
        delete: async (id) => {
          deleted.push(id)
        },
      }),
    })
    await model.openAt(ref('John 15:1'), 'web')
    const source = sourceOf(model)

    source.startEditingCrossReference(vine)
    expect(source.studyMaterial.collection?.editing).toBe(true)
    expect(source.studyMaterial.collection?.description).toBe('Vine imagery')
    source.confirmDeleteCrossReference()
    expect(source.studyMaterial.collection?.confirmingDelete).toBe(true)
    await source.deleteCrossReference()

    expect(deleted).toEqual(['xr-vine'])
    expect(source.studyMaterial.collection).toBe(null)
  })

  it('announces a picked verse and a tapped word on the selection feed', async () => {
    const model = modelWith(
      { passages: passageSourceOver(bsbTexts()), ...strongsDeps() },
      { ...DEFAULT_TOGGLES, strongs: 'on' },
      'bsb',
    )
    await model.openPosition({ book: 43, chapter: 15 })
    const selections: string[] = []
    sourceOf(model).onSelection((kind) => selections.push(kind))

    await model.selectVerse(verse4)
    expect(selections).toEqual(['verse'])

    await model.selectWord(verse4, ['G3306'])
    expect(selections).toEqual(['verse', 'word'])
  })

  it('keeps deselection and clearing off the selection feed', async () => {
    const model = modelWith()
    await model.openAt(ref('John 15:1'), 'web')
    await model.selectVerse(verse2)
    const source = sourceOf(model)
    let selections = 0
    source.onSelection(() => selections++)

    await model.selectVerse(verse2)
    expect(selections).toBe(0)

    await model.selectVerse(verse4)
    expect(selections).toBe(1)

    source.clearSelection()
    expect(selections).toBe(1)
  })

  it('keeps material changes that are not selections off the feed', async () => {
    const model = modelWith()
    await model.openAt(ref('John 15:1'), 'web')
    await model.selectVerse(verse2)
    const source = sourceOf(model)
    let selections = 0
    source.onSelection(() => selections++)

    model.extendSelectionTo(verse4)
    source.startCollecting()
    await model.openAt(ref('John 15:1'), 'web')

    expect(selections).toBe(0)
  })

  it('stops announcing selections once the listener unsubscribes', async () => {
    const model = modelWith()
    await model.openAt(ref('John 15:1'), 'web')
    let selections = 0
    const unsubscribe = sourceOf(model).onSelection(() => selections++)

    unsubscribe()
    await model.selectVerse(verse2)

    expect(selections).toBe(0)
  })

  it('prefills the chapter-level annotate action from the selection, falling back to the chapter', async () => {
    const model = modelWith()
    await model.openAt(ref('John 15:1'), 'web')
    const source = sourceOf(model)

    expect(source.chapterAnnotationReference()).toEqual(ref('John 15'))

    await model.selectVerse(verse2)
    model.extendSelectionTo(verse4)
    expect(source.chapterAnnotationReference()).toEqual(ref('John 15:2-4'))
  })
})

describe('chapter annotations in the study material', () => {
  type IndexedAnnotation = {
    file: string
    reference: Reference
    body: string
    created: number
    annotation?: boolean
  }

  const indexOver = (notes: () => IndexedAnnotation[]) => ({
    intersecting: (reference: Reference): OccurrenceGroup[] =>
      notes()
        .filter((note) => referencesIntersect(note.reference, reference))
        .map((note) => ({
          file: note.file,
          annotationReference:
            note.annotation === false ? null : note.reference,
          occurrences: [
            {
              file: note.file,
              position: 0,
              reference: note.reference,
              source:
                note.annotation === false
                  ? ('body' as const)
                  : ('annotation-frontmatter' as const),
            },
          ],
        })),
    annotationDetails: async (file: string) => {
      const note = notes().find((candidate) => candidate.file === file)
      if (note === undefined) return null
      return { body: note.body, created: note.created }
    },
  })

  it('lists every annotation intersecting the chapter without a verse selected', async () => {
    const model = modelWith(
      indexOver(() => [
        {
          file: 'abide.md',
          reference: ref('John 15:4-6'),
          body: 'Abiding',
          created: 2,
        },
        {
          file: 'branch.md',
          reference: ref('John 15:2'),
          body: 'Pruning',
          created: 1,
        },
      ]),
    )

    await model.openAt(ref('John 15:1'), 'web')

    expect(model.studyMaterial.selectedVerseId).toBe(null)
    expect(model.studyMaterial.chapterAnnotations).toEqual([
      { file: 'branch.md', label: 'John 15:2', body: 'Pruning' },
      { file: 'abide.md', label: 'John 15:4-6', body: 'Abiding' },
    ])
  })

  it('keeps mentions out of the chapter annotation list', async () => {
    const model = modelWith(
      indexOver(() => [
        {
          file: 'sermon.md',
          reference: ref('John 15:1'),
          body: 'Body mention',
          created: 1,
          annotation: false,
        },
      ]),
    )

    await model.openAt(ref('John 15:1'), 'web')

    expect(model.studyMaterial.chapterAnnotations).toEqual([])
  })

  it('breaks same-position ties by the configured annotation ordering', async () => {
    const notes = [
      {
        file: 'a-younger.md',
        reference: ref('John 15:4'),
        body: 'Later',
        created: 200,
      },
      {
        file: 'z-older.md',
        reference: ref('John 15:4'),
        body: 'Earlier',
        created: 100,
      },
    ]
    const byCreation = modelWith(indexOver(() => notes))
    await byCreation.openAt(ref('John 15:1'), 'web')
    expect(
      byCreation.studyMaterial.chapterAnnotations.map((item) => item.file),
    ).toEqual(['z-older.md', 'a-younger.md'])

    const byPath = modelWith(
      indexOver(() => notes),
      DEFAULT_TOGGLES,
      'web',
      'path-a-z',
    )
    await byPath.openAt(ref('John 15:1'), 'web')
    expect(
      byPath.studyMaterial.chapterAnnotations.map((item) => item.file),
    ).toEqual(['a-younger.md', 'z-older.md'])
  })

  it('re-sorts loaded annotations on an ordering change without re-reading notes', async () => {
    let reads = 0
    const model = modelWith({
      intersecting: () => [
        group('z-older.md', 'John 15:4'),
        group('a-younger.md', 'John 15:4'),
      ],
      annotationDetails: async (file) => {
        reads += 1
        return { body: file, created: file === 'z-older.md' ? 100 : 200 }
      },
    })
    await model.openAt(ref('John 15:1'), 'web')
    expect(
      model.studyMaterial.chapterAnnotations.map((item) => item.file),
    ).toEqual(['z-older.md', 'a-younger.md'])
    const readsAfterLoad = reads

    model.setAnnotationOrdering('path-a-z')

    expect(reads).toBe(readsAfterLoad)
    expect(
      model.studyMaterial.chapterAnnotations.map((item) => item.file),
    ).toEqual(['a-younger.md', 'z-older.md'])
  })

  it('follows the reader to the next chapter', async () => {
    const model = modelWith({
      ...indexOver(() => [
        {
          file: 'abide.md',
          reference: ref('John 15:4'),
          body: 'Abiding',
          created: 1,
        },
        {
          file: 'spirit.md',
          reference: ref('John 16:13'),
          body: 'Guidance',
          created: 2,
        },
      ]),
      passages: passageSourceOver({
        web: {
          ...john15Texts().web,
          [makeVerseId(43, 16, 1)]: 'These things I have spoken.',
        },
      }),
    })
    await model.openAt(ref('John 15:1'), 'web')

    await model.nextChapter()

    expect(
      model.studyMaterial.chapterAnnotations.map((item) => item.file),
    ).toEqual(['spirit.md'])
  })

  it('refreshes the list when the vault index changes', async () => {
    const notes: IndexedAnnotation[] = []
    const model = modelWith(indexOver(() => notes))
    await model.openAt(ref('John 15:1'), 'web')
    expect(model.studyMaterial.chapterAnnotations).toEqual([])

    notes.push({
      file: 'abide.md',
      reference: ref('John 15:4'),
      body: 'Abiding',
      created: 1,
    })
    await model.refreshOccurrences()

    expect(model.studyMaterial.chapterAnnotations).toEqual([
      { file: 'abide.md', label: 'John 15:4', body: 'Abiding' },
    ])
  })

  it('lists an annotation whose frontmatter ref lies outside the chapter, placed by its intersecting body ref', async () => {
    const model = modelWith({
      intersecting: () => [
        group('Annotations/Later.md', 'John 15:4'),
        group('Annotations/Farewell.md', 'John 14:1', 'John 15:2'),
      ],
      annotationDetails: async (file) => ({
        body: file,
        created: 1,
      }),
    })

    await model.openAt(ref('John 15:1'), 'web')

    expect(model.studyMaterial.chapterAnnotations).toEqual([
      {
        file: 'Annotations/Farewell.md',
        label: 'John 14:1',
        body: 'Annotations/Farewell.md',
      },
      {
        file: 'Annotations/Later.md',
        label: 'John 15:4',
        body: 'Annotations/Later.md',
      },
    ])
  })

  it('drops annotations whose note no longer loads', async () => {
    const model = modelWith({
      ...indexOver(() => [
        {
          file: 'gone.md',
          reference: ref('John 15:4'),
          body: '',
          created: 1,
        },
      ]),
      annotationDetails: async () => null,
    })

    await model.openAt(ref('John 15:1'), 'web')

    expect(model.studyMaterial.chapterAnnotations).toEqual([])
  })
})

describe('chapter mentions in the study material', () => {
  type IndexedNote = {
    file: string
    references: Reference[]
    annotation?: boolean
  }

  const indexOver = (notes: () => IndexedNote[]) => ({
    intersecting: (reference: Reference): OccurrenceGroup[] =>
      notes()
        .map((note) => ({
          file: note.file,
          annotationReference:
            note.annotation === true ? note.references[0] : null,
          occurrences: note.references
            .filter((noteReference) =>
              referencesIntersect(noteReference, reference),
            )
            .map((noteReference, position) => ({
              file: note.file,
              position,
              reference: noteReference,
              source:
                note.annotation === true
                  ? ('annotation-frontmatter' as const)
                  : ('body' as const),
            })),
        }))
        .filter((group) => group.occurrences.length > 0),
    annotationDetails: async () => ({ body: '', created: 0 }),
  })

  it('lists every mention intersecting the chapter without a verse selected', async () => {
    const model = modelWith(
      indexOver(() => [
        { file: 'sermons/vine.md', references: [ref('John 15:5')] },
        { file: 'branch.md', references: [ref('John 15:2'), ref('John 15:9')] },
      ]),
    )

    await model.openAt(ref('John 15:1'), 'web')

    expect(model.studyMaterial.selectedVerseId).toBe(null)
    expect(model.studyMaterial.chapterMentions).toEqual([
      { file: 'branch.md', title: 'branch', labels: ['John 15:2', 'John 15:9'] },
      { file: 'sermons/vine.md', title: 'vine', labels: ['John 15:5'] },
    ])
  })

  it('breaks scripture-position ties by path A-Z', async () => {
    const model = modelWith(
      indexOver(() => [
        { file: 'b.md', references: [ref('John 15:4')] },
        { file: 'a.md', references: [ref('John 15:4')] },
      ]),
    )

    await model.openAt(ref('John 15:1'), 'web')

    expect(
      model.studyMaterial.chapterMentions.map((item) => item.file),
    ).toEqual(['a.md', 'b.md'])
  })

  it('never lists an annotation as a mention, even when its body intersects', async () => {
    const model = modelWith(
      indexOver(() => [
        {
          file: 'abide.md',
          references: [ref('John 15:4'), ref('John 15:6')],
          annotation: true,
        },
      ]),
    )

    await model.openAt(ref('John 15:1'), 'web')

    expect(model.studyMaterial.chapterMentions).toEqual([])
  })

  it('never lists an annotation as a mention when only its body intersects the chapter', async () => {
    const model = modelWith({
      intersecting: () => [
        group('Annotations/Farewell.md', 'John 14:1', 'John 15:4'),
      ],
      annotationDetails: async () => ({ body: 'Comfort', created: 1 }),
    })

    await model.openAt(ref('John 15:1'), 'web')

    expect(model.studyMaterial.chapterMentions).toEqual([])
    expect(
      model.studyMaterial.chapterAnnotations.map((item) => item.file),
    ).toEqual(['Annotations/Farewell.md'])
  })

  it('follows the reader to the next chapter', async () => {
    const model = modelWith({
      ...indexOver(() => [
        { file: 'abide.md', references: [ref('John 15:4')] },
        { file: 'spirit.md', references: [ref('John 16:13')] },
      ]),
      passages: passageSourceOver({
        web: {
          ...john15Texts().web,
          [makeVerseId(43, 16, 1)]: 'These things I have spoken.',
        },
      }),
    })
    await model.openAt(ref('John 15:1'), 'web')

    await model.nextChapter()

    expect(
      model.studyMaterial.chapterMentions.map((item) => item.file),
    ).toEqual(['spirit.md'])
  })

  it('refreshes the list when the vault index changes', async () => {
    const notes: IndexedNote[] = []
    const model = modelWith(indexOver(() => notes))
    await model.openAt(ref('John 15:1'), 'web')
    expect(model.studyMaterial.chapterMentions).toEqual([])

    notes.push({ file: 'abide.md', references: [ref('John 15:4')] })
    await model.refreshOccurrences()

    expect(model.studyMaterial.chapterMentions).toEqual([
      { file: 'abide.md', title: 'abide', labels: ['John 15:4'] },
    ])
  })
})

const HUMILITY = 101

const HUMILITY_SECTIONS: ReaderBookSection[] = [
  { chapter: 0, name: 'Preface' },
  { chapter: 1, name: 'The Glory of the Creature' },
  { chapter: 2, name: 'The Secret of Redemption' },
  { chapter: 3, name: 'In the Life of Jesus' },
  { chapter: 4, name: 'In the Teaching of Jesus' },
  { chapter: 5, name: 'In the Disciples of Jesus' },
  { chapter: 6, name: 'In Daily Life' },
  { chapter: 7, name: 'And Holiness' },
  { chapter: 8, name: 'And Sin' },
  { chapter: 9, name: 'And Faith' },
  { chapter: 10, name: 'And Death to Self' },
  { chapter: 11, name: 'And Happiness' },
  { chapter: 12, name: 'And Exaltation' },
  { chapter: 13, name: 'Note A' },
  { chapter: 14, name: 'Note B' },
  { chapter: 15, name: 'Note C' },
  { chapter: 16, name: 'Note D' },
  { chapter: 17, name: 'A Prayer for Humility' },
]

const humility = (): ReaderBook => ({
  number: HUMILITY,
  title: 'Humility',
  author: 'Andrew Murray',
  year: 1895,
  editionId: 'hum-m1895',
  sections: HUMILITY_SECTIONS,
})

const CROWNS: Epigraph = {
  quote: 'They shall cast their crowns before the throne.',
  attribution: 'Rev. iv. 11',
}

const humilityTexts = (): MockTexts => ({
  'hum-m1895': {
    [makeVerseId(HUMILITY, 0, 1)]: 'In the Preface.',
    [makeVerseId(HUMILITY, 1, 1)]: 'When God created the universe.',
    [makeVerseId(HUMILITY, 1, 2)]: 'And so pride is the root.',
    [makeVerseId(HUMILITY, 1, 3)]: 'Humility is the only soil.',
    [makeVerseId(HUMILITY, 17, 1)]: 'O God, who resistest the proud.',
  },
})

const INERT_BOOKS: ReaderBookSource = {
  installed: async () => [],
  epigraphs: async () => [],
}

const bookModelWith = (
  overrides: Partial<ReaderPaneDeps> = {},
  toggles: ReaderToggles = DEFAULT_TOGGLES,
): ReaderPaneModel =>
  new ReaderPaneModel(
    {
      passages: passageSourceOver({ ...john15Texts(), ...humilityTexts() }),
      availableTranslations: async () => [translation('web')],
      intersecting: () => [],
      crossReferences: crossReferencesOf(),
      annotationDetails: async () => null,
      strongs: {
        dictionariesInstalled: async () => true,
        entriesFor: async () => [],
        attribution: 'STEPBible CC BY 4.0',
      },
      books: {
        installed: async () => [humility()],
        epigraphs: async (editionId, chapter) =>
          editionId === 'hum-m1895' && chapter === 1 ? [CROWNS] : [],
      },
      ...overrides,
    },
    { toggles, translationId: 'web' },
  )

const bookRef = (chapter: number, from: number, to = from): Reference => ({
  book: HUMILITY,
  ranges: [
    {
      startId: makeVerseId(HUMILITY, chapter, from),
      endId: makeVerseId(HUMILITY, chapter, to),
    },
  ],
})

// The sections the printed work carries no chapter number for: their name
// replaces the chapter locator wherever a reference to them is displayed.
const NAMED_SECTIONS = new Set([0, 13, 14, 15, 16, 17])

describe('ReaderPaneModel book mode', () => {
  beforeEach(() => {
    const sections = HUMILITY_SECTIONS.map(({ chapter, name }) => ({
      chapter,
      name,
      named: NAMED_SECTIONS.has(chapter),
      paragraphs: 20,
    }))
    registerBookVersification({ book: HUMILITY, sections })
    registerBook({
      id: HUMILITY,
      name: 'Humility',
      abbrev: 'Hum',
      aliases: [],
      moduleId: 'hum-m1895',
      editionCode: 'HUM-M1895',
      author: 'Andrew Murray',
      year: 1895,
      sections,
    })
  })

  afterEach(() => {
    deregisterBookVersification(HUMILITY)
    deregisterBook(HUMILITY)
  })

  it('renders a section as book prose with its epigraph and paragraph numbers', async () => {
    const model = bookModelWith()

    await model.openPosition({ book: HUMILITY, chapter: 1 })

    const view = model.view
    expect(view.status).toBe('ok')
    expect(view.book?.title).toBe('Humility')
    expect(view.book?.author).toBe('Andrew Murray')
    expect(view.book?.sectionName).toBe('The Glory of the Creature')
    expect(view.book?.epigraphs).toEqual([
      {
        quote: CROWNS.quote,
        attribution: [{ text: 'Rev. iv. 11', redLetter: false }],
      },
    ])
    expect(view.rows.map((row) => row.label)).toEqual(['1', '2', '3'])
  })

  it('renders a section without an epigraph', async () => {
    const model = bookModelWith()

    await model.openPosition({ book: HUMILITY, chapter: 0 })

    expect(model.view.book?.sectionName).toBe('Preface')
    expect(model.view.book?.epigraphs).toEqual([])
  })

  it('titles the pane by book and section', async () => {
    const model = bookModelWith()

    await model.openPosition({ book: HUMILITY, chapter: 1 })

    expect(model.view.title).toBe('Humility — The Glory of the Creature')
  })

  it("offers the book's own named-section TOC, marking the section in view", async () => {
    const model = bookModelWith()

    await model.openPosition({ book: HUMILITY, chapter: 13 })

    const sections = model.view.book?.sections ?? []
    expect(sections).toHaveLength(18)
    expect(sections[0]).toEqual({ chapter: 0, name: 'Preface', current: false })
    expect(sections[13]).toEqual({ chapter: 13, name: 'Note A', current: true })
    expect(sections[17].name).toBe('A Prayer for Humility')
  })

  it('steps between sections and stops at both ends of the book', async () => {
    const model = bookModelWith()
    await model.openPosition({ book: HUMILITY, chapter: 0 })

    expect(model.view.hasPreviousChapter).toBe(false)
    expect(model.view.hasNextChapter).toBe(true)

    await model.nextChapter()
    expect(model.view.position).toEqual({ book: HUMILITY, chapter: 1 })
    expect(model.view.hasPreviousChapter).toBe(true)

    await model.previousChapter()
    expect(model.view.position).toEqual({ book: HUMILITY, chapter: 0 })

    await model.openPosition({ book: HUMILITY, chapter: 17 })
    expect(model.view.hasNextChapter).toBe(false)
    await model.nextChapter()
    expect(model.view.position).toEqual({ book: HUMILITY, chapter: 17 })
  })

  it('shows a single non-switchable edition pill instead of translations', async () => {
    const model = bookModelWith()

    await model.openPosition({ book: HUMILITY, chapter: 1 })

    expect(model.view.book?.edition).toBe('Humility 1895')
    expect(model.view.translations).toEqual([])
  })

  it("hides Strong's in book mode however the pane's toggle stands", async () => {
    const model = bookModelWith({}, { ...DEFAULT_TOGGLES, strongs: 'on' })

    await model.openPosition({ book: HUMILITY, chapter: 1 })

    expect(model.view.strongsAvailable).toBe(false)
    expect(model.view.strongsMode).toBe(false)
  })

  it('leaves scripture mode untouched', async () => {
    const model = bookModelWith()

    await model.openAt(ref('John 15:1'), 'web')

    expect(model.view.book).toBeNull()
    expect(model.view.translations.map((pill) => pill.id)).toEqual(['web'])
    expect(model.view.title).toBe('John 15')
  })

  it('carries the paragraph-number option as an in-pane toggle', async () => {
    const model = bookModelWith(
      {},
      { ...DEFAULT_TOGGLES, paraNumbers: 'hover' },
    )
    await model.openPosition({ book: HUMILITY, chapter: 1 })
    expect(model.view.toggles.paraNumbers).toBe('hover')

    model.setToggle('paraNumbers', 'on')

    expect(model.view.toggles.paraNumbers).toBe('on')
  })

  it('lands on the paragraph a book chip points at, highlighted and bannered', async () => {
    const model = bookModelWith()

    await model.openAt(bookRef(1, 2, 3), null)

    expect(model.view.position).toEqual({ book: HUMILITY, chapter: 1 })
    expect(
      model.view.rows.filter((row) => row.highlighted).map((row) => row.label),
    ).toEqual(['2', '3'])
    expect(model.view.banner).toBe('Opened at Humility ch. 1, pars. 2-3')
  })

  it('banners a single-paragraph entry without a range', async () => {
    const model = bookModelWith()

    await model.openAt(bookRef(1, 2), null)

    expect(model.view.banner).toBe('Opened at Humility ch. 1, par. 2')
  })

  it('names an unnamed section by its display name in the banner', async () => {
    const model = bookModelWith()

    await model.openAt(bookRef(0, 1), null)

    expect(model.view.banner).toBe('Opened at Humility Preface, par. 1')
  })

  it('keeps the scripture translation across a visit to a book', async () => {
    const model = bookModelWith()
    await model.openAt(ref('John 15:1'), 'web')

    await model.openPosition({ book: HUMILITY, chapter: 1 })
    await model.openPosition({ book: 43, chapter: 15 })

    expect(model.view.translations.map((pill) => pill.active)).toEqual([true])
    expect(model.view.status).toBe('ok')
  })

  it('reports an uninstalled book as unavailable', async () => {
    const model = bookModelWith({ books: INERT_BOOKS })

    await model.openPosition({ book: HUMILITY, chapter: 1 })

    expect(model.view.status).toBe('unavailable')
    expect(model.view.book).toBeNull()
  })

  it('renders a book even with no translation installed', async () => {
    const model = bookModelWith({ availableTranslations: async () => [] })

    await model.openPosition({ book: HUMILITY, chapter: 1 })

    expect(model.view.status).toBe('ok')
  })

  it('marks the paragraphs notes annotate or merely mention', async () => {
    const model = bookModelWith({
      intersecting: () => [
        group('Annotations/Humility 1.2.md', 'Humility 1:2'),
        group('Sermons/Lowly.md', null, 'Humility 1:3'),
      ],
    })

    await model.openPosition({ book: HUMILITY, chapter: 1 })

    expect(
      model.view.rows.map((row) => [row.annotations, row.mentions]),
    ).toEqual([
      [0, 0],
      [1, 0],
      [0, 1],
    ])
  })

  it('lists the section as the chapter scope of its annotations and mentions', async () => {
    const model = bookModelWith({
      intersecting: () => [
        group('Annotations/Preface.md', 'Humility 0:1'),
        group('Sermons/Lowly.md', null, 'Humility 0:1'),
      ],
      annotationDetails: async () => ({ body: 'Lowliness.', created: 1 }),
    })

    await model.openPosition({ book: HUMILITY, chapter: 0 })

    const material = model.studyMaterial
    expect(material.chapterAnnotations.map((item) => item.label)).toEqual([
      'Humility 0:1',
    ])
    expect(material.chapterMentions.map((item) => item.file)).toEqual([
      'Sermons/Lowly.md',
    ])
  })

  it("shows the selected paragraph's citation and text instead of translations", async () => {
    const model = bookModelWith()
    model.setDetailsWanted(true)
    await model.openPosition({ book: HUMILITY, chapter: 1 })

    await model.selectVerse(makeVerseId(HUMILITY, 1, 2))

    expect(detailsOf(model)).toEqual({
      verseId: makeVerseId(HUMILITY, 1, 2),
      title: 'Humility ch. 1, par. 2',
      book: {
        citation: 'Andrew Murray, Humility (1895), ch. 1, par. 2',
        text: 'And so pride is the root.',
      },
      translations: [],
      strongs: [],
      strongsAttribution: null,
    })
  })

  it('runs the paragraph details across an extended selection', async () => {
    const model = bookModelWith()
    model.setDetailsWanted(true)
    await model.openPosition({ book: HUMILITY, chapter: 1 })

    await model.selectVerse(makeVerseId(HUMILITY, 1, 2))
    model.extendSelectionTo(makeVerseId(HUMILITY, 1, 3))
    await flushAsync()

    const details = detailsOf(model)
    expect(details.title).toBe('Humility ch. 1, pars. 2-3')
    expect(details.book?.text).toBe(
      'And so pride is the root. Humility is the only soil.',
    )
  })

  it('tells the study material it is showing a book', async () => {
    const model = bookModelWith()

    await model.openPosition({ book: HUMILITY, chapter: 1 })
    expect(model.studyMaterial.bookMode).toBe(true)

    await model.openAt(ref('John 15:1'), 'web')
    expect(model.studyMaterial.bookMode).toBe(false)
  })

  it('collects a book paragraph beside scripture, each in its own format', async () => {
    const model = bookModelWith()
    await model.openPosition({ book: HUMILITY, chapter: 1 })
    model.startCollecting()

    await model.selectVerse(makeVerseId(HUMILITY, 1, 2))
    model.addSelectionToCollection()
    model.typeMember('John 15:5')
    model.addTypedReferenceToCollection()

    expect(
      model.studyMaterial.collection?.members.map((member) => member.label),
    ).toEqual(['Humility ch. 1, par. 2', 'John 15:5'])
    expect(model.studyMaterial.collection?.canSave).toBe(true)
  })

  it('lists a cross-reference touching the section on screen', async () => {
    const entry = {
      id: 'xr-pride',
      description: 'Pride and its cure',
      members: [ref('John 15:5'), bookRef(1, 2)],
    }
    const model = bookModelWith({
      crossReferences: crossReferencesOf({ intersecting: () => [entry] }),
    })

    await model.openPosition({ book: HUMILITY, chapter: 1 })

    const listed = model.studyMaterial.chapterCrossReferences
    expect(listed.map((view) => view.id)).toEqual(['xr-pride'])
    expect(listed[0].members.map((member) => member.label)).toEqual([
      'Humility ch. 1, par. 2',
      'John 15:5',
    ])
  })
})

// The book's addressable name — registered the way its module registers it
// on install (ticket #72) — so the copied reference round-trips through the
// same parser a note typed it into.
const HUMILITY_REGISTRATION: RegisteredBook = {
  id: HUMILITY,
  name: 'Humility',
  abbrev: 'Hum',
  aliases: [],
  moduleId: 'hum-m1895',
  editionCode: 'HUM-M1895',
  author: 'Andrew Murray',
  year: 1895,
  sections: HUMILITY_SECTIONS.map(({ chapter, name }) => ({
    chapter,
    name,
    named: chapter === 0 || chapter >= 13,
  })),
}

describe('copying a book selection as a formatted reference', () => {
  beforeEach(() => {
    registerBookVersification({
      book: HUMILITY,
      sections: HUMILITY_SECTIONS.map(({ chapter }) => ({
        chapter,
        paragraphs: 20,
      })),
    })
    registerBook(HUMILITY_REGISTRATION)
  })

  afterEach(() => {
    deregisterBookVersification(HUMILITY)
    deregisterBook(HUMILITY)
  })

  it('copies an unnumbered section by its section number, round-tripping through the parser', async () => {
    const clipboard = fakeClipboard()
    const model = bookModelWith({ clipboard })
    await model.openPosition({ book: HUMILITY, chapter: 0 })
    await model.selectVerse(makeVerseId(HUMILITY, 0, 1))

    await model.copyFormattedReference()

    expect(clipboard.copied).toEqual(['{Humility 0:1}'])
    const pasted = clipboard.copied[0].slice(1, -1)
    expect(parseReference(pasted, { translationIds: [] })?.reference).toEqual(
      bookRef(0, 1),
    )
  })

  it('copies an extended paragraph selection as one span', async () => {
    const clipboard = fakeClipboard()
    const model = bookModelWith({ clipboard })
    await model.openPosition({ book: HUMILITY, chapter: 1 })
    await model.selectVerse(makeVerseId(HUMILITY, 1, 2))
    model.extendSelectionTo(makeVerseId(HUMILITY, 1, 3))

    await model.copyFormattedReference()

    expect(clipboard.copied).toEqual(['{Humility 1:2-3}'])
    const pasted = clipboard.copied[0].slice(1, -1)
    expect(parseReference(pasted, { translationIds: [] })?.reference).toEqual(
      bookRef(1, 2, 3),
    )
  })
})

// Murray's own citations are live links in the prose (spec-books §8): the
// module ships them as a refs channel, the pane surfaces them per segment,
// and tapping one is an ordinary reader entry.
describe('ref spans', () => {
  beforeEach(() => {
    registerBookVersification({
      book: HUMILITY,
      sections: HUMILITY_SECTIONS.map(({ chapter }) => ({
        chapter,
        paragraphs: 20,
      })),
    })
    registerBook(HUMILITY_REGISTRATION)
  })

  afterEach(() => {
    deregisterBookVersification(HUMILITY)
    deregisterBook(HUMILITY)
  })

  const JOHN_5_30 = {
    startId: makeVerseId(43, 5, 30),
    endId: makeVerseId(43, 5, 30),
  }
  const NOTE_A = {
    startId: makeVerseId(HUMILITY, 13, 1),
    endId: makeVerseId(HUMILITY, 13, 2),
  }

  const scripture = passageSourceOver({
    web: { [makeVerseId(43, 5, 30)]: 'I can of Myself do nothing.' },
  })

  // Every section of the book reads the same, so a Note pointer's target
  // renders as readily as the paragraph that points at it.
  const citingBookModel = (): ReaderPaneModel =>
    bookModelWith({
      passages: {
        passage: async (reference, translationId) => {
          if (translationId !== 'hum-m1895')
            return scripture.passage(reference, translationId)
          return {
            status: 'ok',
            attribution: null,
            verses: [
              {
                verseId: reference.ranges[0].startId,
                segments: [
                  { text: 'He said ', redLetter: false },
                  { text: 'John v. 30', redLetter: false, refs: [JOHN_5_30] },
                  { text: ' and ', redLetter: false },
                  { text: 'See Note A.', redLetter: false, refs: [NOTE_A] },
                ],
              },
            ],
          }
        },
      },
      books: {
        installed: async () => [humility()],
        epigraphs: async () => [
          { ...CROWNS, refs: [{ start: 0, end: 11, ranges: [JOHN_5_30] }] },
        ],
      },
    })

  it('surfaces a paragraph ref span as a segment property', async () => {
    const model = citingBookModel()

    await model.openPosition({ book: HUMILITY, chapter: 1 })

    expect(
      model.view.rows[0].segments.map((segment) => segment.refs),
    ).toEqual([undefined, [JOHN_5_30], undefined, [NOTE_A]])
  })

  it('surfaces an epigraph ref span over the attribution line', async () => {
    const model = citingBookModel()

    await model.openPosition({ book: HUMILITY, chapter: 1 })

    expect(model.view.book?.epigraphs[0].attribution).toEqual([
      { text: 'Rev. iv. 11', redLetter: false, refs: [JOHN_5_30] },
    ])
  })

  it('opens the scripture reader at the cited passage, highlighted and bannered', async () => {
    const model = citingBookModel()
    await model.openPosition({ book: HUMILITY, chapter: 1 })

    await model.openRefSpan([JOHN_5_30])

    expect(model.view.position).toEqual({ book: 43, chapter: 5 })
    expect(model.view.book).toBeNull()
    expect(
      model.view.rows.filter((row) => row.highlighted).map((row) => row.label),
    ).toEqual(['30'])
    expect(model.view.banner).toBe('Opened at John 5:30')
  })

  it('keeps a Note pointer inside the book reader', async () => {
    const model = citingBookModel()
    await model.openPosition({ book: HUMILITY, chapter: 1 })

    await model.openRefSpan([NOTE_A])

    expect(model.view.position).toEqual({ book: HUMILITY, chapter: 13 })
    expect(model.view.book?.sectionName).toBe('Note A')
    expect(model.view.banner).toBe('Opened at Humility Note A, pars. 1-2')
  })

  it('walks the pane history like any other reader move', async () => {
    const visited: ReaderPosition[] = []
    const model = citingBookModel()
    model.useNavigation(async (position, open) => {
      visited.push(position)
      await open()
    })
    await model.openPosition({ book: HUMILITY, chapter: 1 })

    await model.openRefSpan([JOHN_5_30])

    expect(visited).toEqual([{ book: 43, chapter: 5 }])
  })

  it('ignores a span with no ranges', async () => {
    const model = citingBookModel()
    await model.openPosition({ book: HUMILITY, chapter: 1 })

    await model.openRefSpan([])

    expect(model.view.position).toEqual({ book: HUMILITY, chapter: 1 })
  })
})

describe('opening a nav target in a new tab', () => {
  beforeEach(() => {
    registerBookVersification({
      book: HUMILITY,
      sections: HUMILITY_SECTIONS.map(({ chapter }) => ({
        chapter,
        paragraphs: 20,
      })),
    })
    registerBook(HUMILITY_REGISTRATION)
  })

  afterEach(() => {
    deregisterBookVersification(HUMILITY)
    deregisterBook(HUMILITY)
  })

  const modelSpawning = (opened: ReaderPosition[]): ReaderPaneModel =>
    bookModelWith({ newTab: (position) => opened.push(position) })

  it('spawns a tab at the target and leaves this pane where it stands', async () => {
    const opened: ReaderPosition[] = []
    const model = modelSpawning(opened)
    await model.openAt(ref('John 15:1'), 'web')

    await model.goTo(HUMILITY, 0, { newTab: true })

    expect(opened).toEqual([{ book: HUMILITY, chapter: 0 }])
    expect(model.view.position).toEqual({ book: 43, chapter: 15 })
    expect(model.view.book).toBeNull()
  })

  it('keeps a new-tab target out of this pane history', async () => {
    const opened: ReaderPosition[] = []
    const visited: ReaderPosition[] = []
    const model = modelSpawning(opened)
    await model.openAt(ref('John 15:1'), 'web')
    model.useNavigation(async (position, open) => {
      visited.push(position)
      await open()
    })

    await model.goTo(1, 1, { newTab: true })

    expect(visited).toEqual([])
  })

  it('spawns a tab at a tree book node instead of expanding it', async () => {
    const opened: ReaderPosition[] = []
    const model = modelSpawning(opened)
    await model.openAt(ref('John 15:1'), 'web')

    model.browseBook(10, { newTab: true })

    expect(opened).toEqual([{ book: 10, chapter: 1 }])
    expect(model.view.treeBook).toBe(43)
  })

  it('navigates in place when the shell offers no new tab', async () => {
    const model = bookModelWith()
    await model.openAt(ref('John 15:1'), 'web')

    await model.goTo(1, 1, { newTab: true })

    expect(model.view.position).toEqual({ book: 1, chapter: 1 })
  })
})
