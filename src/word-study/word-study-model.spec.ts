import { describe, expect, it, vi } from 'vitest'
import { NOOP_REFERENCE_NAVIGATOR, type StrongsEntryView } from '../contracts'
import { makeVerseId } from '../reference'
import {
  WordStudyModel,
  type ConcordanceRendering,
  type ConcordanceSegment,
  type WordStudyEntry,
} from './word-study-model'

const entryView = (strongs: string): StrongsEntryView => ({
  strongs,
  variant: strongs,
  lemma: 'ἀγάπη',
  transliteration: 'agapē',
  morphology: 'G:N-F',
  gloss: 'love',
  definition: 'love, affection, benevolence',
})

const entry = (
  strongs: string,
  extras: Partial<Omit<WordStudyEntry, 'entry'>> = {},
): WordStudyEntry => ({
  entry: entryView(strongs),
  siblings: [],
  derivation: null,
  ...extras,
})

// The dictionary module seen through the word study's own seam: installed or
// not, and one entry per extended number.
const fakeDictionary = (
  entries: Record<string, WordStudyEntry> = {},
  options: { installed?: boolean } = {},
) => {
  let installed = options.installed ?? true
  let installError: Error | null = null
  let installGate: Promise<void> = Promise.resolve()
  const lookups: string[] = []
  return {
    lookups,
    failInstallWith: (error: Error) => {
      installError = error
    },
    gateInstall: () => {
      let release = () => {}
      installGate = new Promise<void>((resolve) => {
        release = resolve
      })
      return () => release()
    },
    deps: {
      installed: async () => installed,
      entryFor: async (number: string) => {
        lookups.push(number)
        return entries[number] ?? null
      },
      install: async () => {
        await installGate
        if (installError !== null) throw installError
        installed = true
      },
      attribution: 'Dictionary data: TBESH/TBESG (CC BY 4.0)',
      etymologyAttribution: "Etymology: Strong's (1890, public domain)",
    },
  }
}

const model = (...args: Parameters<typeof fakeDictionary>) => {
  const dictionary = fakeDictionary(...args)
  const openWordStudy = vi.fn(async () => {})
  return {
    dictionary,
    openWordStudy,
    model: new WordStudyModel({
      dictionary: dictionary.deps,
      opener: { openWordStudy },
    }),
  }
}

describe('WordStudyModel', () => {
  it('starts empty, with nothing to study', () => {
    expect(model().model.view).toMatchObject({
      number: null,
      status: 'empty',
      entry: null,
      attribution: null,
      install: null,
    })
  })

  it('shows the entry a number resolves to, headed by that number', async () => {
    const { model: panel } = model({ G0026: entry('G0026') })
    await panel.show('G0026')
    expect(panel.view).toMatchObject({
      number: 'G0026',
      title: 'G0026',
      status: 'ok',
      entry: {
        strongs: 'G0026',
        variant: 'G0026',
        lemma: 'ἀγάπη',
        transliteration: 'agapē',
        morphology: 'G:N-F',
        gloss: 'love',
        definition: 'love, affection, benevolence',
      },
      attribution: 'Dictionary data: TBESH/TBESG (CC BY 4.0)',
      install: null,
    })
  })

  it('lists the family siblings the entry can be walked to', async () => {
    const { model: panel } = model({
      H0001G: entry('H0001G', { siblings: ['H0001H', 'H0001I'] }),
    })
    await panel.show('H0001G')
    expect(panel.view.siblings).toEqual(['H0001H', 'H0001I'])
  })

  it('leaves the siblings empty for an entry that stands alone', async () => {
    const { model: panel } = model({ G0026: entry('G0026') })
    await panel.show('G0026')
    expect(panel.view.siblings).toEqual([])
  })

  it('breaks the derivation into text and the numbers it cites', async () => {
    const { model: panel } = model({
      H0010: entry('H0010', { derivation: 'from H0001 and H3050;' }),
    })
    await panel.show('H0010')
    expect(panel.view.etymology).toEqual([
      { text: 'from ', number: null },
      { text: 'H0001', number: 'H0001' },
      { text: ' and ', number: null },
      { text: 'H3050', number: 'H3050' },
      { text: ';', number: null },
    ])
  })

  it('reads a derivation citing nothing as one plain stretch of text', async () => {
    const { model: panel } = model({
      H0001G: entry('H0001G', { derivation: 'a primitive word;' }),
    })
    await panel.show('H0001G')
    expect(panel.view.etymology).toEqual([
      { text: 'a primitive word;', number: null },
    ])
  })

  it('names the etymology source only while an etymology is on screen', async () => {
    const { model: panel } = model({
      G0026: entry('G0026'),
      H0010: entry('H0010', { derivation: 'from H0001;' }),
    })
    await panel.show('G0026')
    expect(panel.view).toMatchObject({
      etymology: null,
      etymologyAttribution: null,
    })
    await panel.show('H0010')
    expect(panel.view.etymologyAttribution).toBe(
      "Etymology: Strong's (1890, public domain)",
    )
  })

  it('walks to another number the way the activation asked for', async () => {
    const { model: panel, openWordStudy } = model({ G0026: entry('G0026') })
    await panel.show('G0026')
    await panel.open('H0001H')
    await panel.open('H0001I', { newPane: true })
    expect(openWordStudy.mock.calls).toEqual([
      ['H0001H', {}],
      ['H0001I', { newPane: true }],
    ])
  })

  it('names the number it is loading before the entry arrives', () => {
    const { model: panel } = model({ G0026: entry('G0026') })
    void panel.show('G0026')
    expect(panel.view).toMatchObject({
      number: 'G0026',
      status: 'loading',
      entry: null,
    })
  })

  it('notices a number the dictionary has no entry for', async () => {
    const { model: panel } = model({ G0026: entry('G0026') })
    await panel.show('G9999')
    expect(panel.view).toMatchObject({
      number: 'G9999',
      status: 'no-entry',
      entry: null,
      attribution: null,
    })
  })

  it('degrades to an install affordance while the dictionaries are missing', async () => {
    const { model: panel } = model({}, { installed: false })
    await panel.show('G0026')
    expect(panel.view).toMatchObject({
      number: 'G0026',
      status: 'no-dictionary',
      entry: null,
      install: { busy: false, error: null },
    })
  })

  it('never looks a number up while the dictionaries are missing', async () => {
    const { model: panel, dictionary } = model({}, { installed: false })
    await panel.show('G0026')
    expect(dictionary.lookups).toEqual([])
  })

  it('loads the number it was opened with once the dictionaries install', async () => {
    const { model: panel } = model({ G0026: entry('G0026') }, { installed: false })
    await panel.show('G0026')
    await panel.installDictionary()
    expect(panel.view).toMatchObject({ status: 'ok', entry: { strongs: 'G0026' } })
  })

  it('reports the install as busy while it runs', async () => {
    const { model: panel, dictionary } = model({}, { installed: false })
    await panel.show('G0026')
    const release = dictionary.gateInstall()
    const installing = panel.installDictionary()
    expect(panel.view.install).toEqual({ busy: true, error: null })
    release()
    await installing
  })

  it('keeps the affordance standing when the install fails, with the reason', async () => {
    const { model: panel, dictionary } = model({}, { installed: false })
    await panel.show('G0026')
    dictionary.failInstallWith(new Error('offline'))
    await panel.installDictionary()
    expect(panel.view).toMatchObject({
      status: 'no-dictionary',
      install: { busy: false, error: 'offline' },
    })
  })

  it('tells its listeners whenever what it shows changes', async () => {
    const { model: panel } = model({ G0026: entry('G0026') })
    let notices = 0
    const unsubscribe = panel.subscribe(() => {
      notices += 1
    })
    await panel.show('G0026')
    expect(notices).toBeGreaterThan(0)
    unsubscribe()
    await panel.show('G9999')
    expect(panel.view.status).toBe('no-entry')
  })

  it('lets a later number win over one still loading', async () => {
    const { model: panel } = model({
      G0026: entry('G0026'),
      G0025: entry('G0025'),
    })
    const first = panel.show('G0026')
    const second = panel.show('G0025')
    await Promise.all([first, second])
    expect(panel.view).toMatchObject({
      number: 'G0025',
      entry: { strongs: 'G0025' },
    })
  })
})

const KJV = { id: 'kjv', name: 'King James Version' }
const BSB = { id: 'bsb', name: 'Berean Standard Bible' }

// Marked-up verse text the fake splits into emphasized and plain stretches,
// standing for the spans a real concordance re-derives from the verse's tags.
const MARKED: Record<number, string> = {
  [makeVerseId(1, 1, 1)]: 'In the beginning «God» created the heaven.',
  [makeVerseId(1, 2, 4)]: 'the day that the LORD «God» made the earth.',
  [makeVerseId(43, 15, 4)]: 'Abide in me, and I in «you».',
}

const segmentsOf = (verseId: number): ConcordanceSegment[] =>
  (MARKED[verseId] ?? '')
    .split(/«|»/)
    .map((text, index) => ({ text, emphasis: index % 2 === 1 }))
    .filter((segment) => segment.text !== '')

// What one translation answers about a family, where it differs from what the
// rest of them answer.
type FakeIndex = {
  occurrences?: Record<string, number[]>
  renderings?: ConcordanceRendering[]
}

const fakeConcordance = (
  options: {
    translations?: { id: string; name: string }[]
    occurrences?: Record<string, number[]>
    renderings?: ConcordanceRendering[]
    perTranslation?: Record<string, FakeIndex>
  } = {},
) => {
  let translations = options.translations ?? [KJV]
  const own = (translationId: string): FakeIndex =>
    options.perTranslation?.[translationId] ?? {}
  const asked: { translationId: string; verseIds: number[] }[] = []
  return {
    asked,
    uninstall: (translationId: string) => {
      translations = translations.filter(
        (translation) => translation.id !== translationId,
      )
    },
    deps: {
      translations: async () => translations,
      occurrences: async (translationId: string, strongsNumber: string) =>
        (own(translationId).occurrences ?? options.occurrences ?? {})[
          strongsNumber
        ] ?? [],
      renderings: async (translationId: string) =>
        own(translationId).renderings ?? options.renderings ?? [],
      versesFor: async (
        translationId: string,
        _strongsNumber: string,
        verseIds: number[],
      ) => {
        asked.push({ translationId, verseIds })
        return verseIds.map((verseId) => ({
          verseId,
          segments: segmentsOf(verseId),
        }))
      },
    },
  }
}

const concordanceModel = (
  options: Parameters<typeof fakeConcordance>[0] = {},
  entries: Record<string, WordStudyEntry> = { H0430: entry('H0430') },
) => {
  const dictionary = fakeDictionary(entries)
  const concordance = fakeConcordance(options)
  const openReference = vi.fn()
  return {
    concordance,
    openReference,
    model: new WordStudyModel({
      dictionary: dictionary.deps,
      concordance: concordance.deps,
      navigator: { ...NOOP_REFERENCE_NAVIGATOR, openReference },
    }),
  }
}

const occurrencesOf = (verseIds: number[]) => ({ H0430: verseIds })

describe("WordStudyModel's concordance", () => {
  it('heads the occurrences with their count and the translation they are in', async () => {
    const { model: panel } = concordanceModel({
      occurrences: occurrencesOf([makeVerseId(1, 1, 1), makeVerseId(1, 2, 4)]),
    })

    await panel.show('H0430')

    expect(panel.view.concordance).toMatchObject({
      translation: KJV,
      total: 2,
      label: '2 occurrences in KJV',
    })
  })

  it('reads the translation the tapped word came from', async () => {
    const { model: panel } = concordanceModel({
      translations: [KJV, BSB],
      occurrences: occurrencesOf([makeVerseId(1, 1, 1)]),
    })

    await panel.show('H0430', { translationId: 'bsb' })

    expect(panel.view.concordance?.translation).toEqual(BSB)
  })

  it('falls back to the first installed tagged translation', async () => {
    const { model: panel } = concordanceModel({
      translations: [KJV, BSB],
      occurrences: occurrencesOf([makeVerseId(1, 1, 1)]),
    })

    await panel.show('H0430', { translationId: 'nkjv' })

    expect(panel.view.concordance?.translation).toEqual(KJV)
  })

  it('says so while no tagged translation is installed to count in', async () => {
    const { model: panel } = concordanceModel({ translations: [] })

    await panel.show('H0430')

    expect(panel.view.concordance).toMatchObject({
      translation: null,
      translations: [],
      message: 'No Tagged Translation is installed.',
      label: 'Occurrences',
      total: 0,
      books: [],
      renderings: [],
    })
  })

  it('groups the occurrences by book in canon order, collapsed and unloaded', async () => {
    const { concordance, model: panel } = concordanceModel({
      occurrences: occurrencesOf([
        makeVerseId(43, 15, 4),
        makeVerseId(1, 1, 1),
        makeVerseId(1, 2, 4),
      ]),
    })

    await panel.show('H0430')

    expect(panel.view.concordance?.books).toEqual([
      { book: 1, name: 'Genesis', count: 2, expanded: false, verses: null },
      { book: 43, name: 'John', count: 1, expanded: false, verses: null },
    ])
    expect(concordance.asked).toEqual([])
  })

  it('renders a book\'s verse rows only once it is expanded', async () => {
    const { concordance, model: panel } = concordanceModel({
      occurrences: occurrencesOf([makeVerseId(1, 1, 1), makeVerseId(43, 15, 4)]),
    })
    await panel.show('H0430')

    await panel.toggleConcordanceBook(1)

    expect(concordance.asked).toEqual([
      { translationId: 'kjv', verseIds: [makeVerseId(1, 1, 1)] },
    ])
    expect(panel.view.concordance?.books[0]).toEqual({
      book: 1,
      name: 'Genesis',
      count: 1,
      expanded: true,
      verses: [
        {
          verseId: makeVerseId(1, 1, 1),
          reference: 'Genesis 1:1',
          segments: [
            { text: 'In the beginning ', emphasis: false },
            { text: 'God', emphasis: true },
            { text: ' created the heaven.', emphasis: false },
          ],
        },
      ],
    })
  })

  it('keeps a re-expanded book\'s rows instead of loading them again', async () => {
    const { concordance, model: panel } = concordanceModel({
      occurrences: occurrencesOf([makeVerseId(1, 1, 1)]),
    })
    await panel.show('H0430')

    await panel.toggleConcordanceBook(1)
    await panel.toggleConcordanceBook(1)
    expect(panel.view.concordance?.books[0].expanded).toBe(false)
    await panel.toggleConcordanceBook(1)

    expect(concordance.asked).toHaveLength(1)
    expect(panel.view.concordance?.books[0].expanded).toBe(true)
  })

  it('serves a number the dictionaries carry no entry for', async () => {
    const { model: panel } = concordanceModel(
      { occurrences: occurrencesOf([makeVerseId(1, 1, 1)]) },
      {},
    )

    await panel.show('H0430')

    expect(panel.view.status).toBe('no-entry')
    expect(panel.view.concordance).toMatchObject({ total: 1 })
  })

  it('says the occurrences cover the family undifferentiated', async () => {
    const { model: panel } = concordanceModel(
      { occurrences: occurrencesOf([makeVerseId(1, 1, 1)]) },
      { H0430: entry('H0430', { siblings: ['H0430B'] }) },
    )

    await panel.show('H0430')

    expect(panel.view.concordance?.familyUndifferentiated).toBe(true)
  })

  it('claims no undifferentiated family for a number that stands alone', async () => {
    const { model: panel } = concordanceModel({
      occurrences: occurrencesOf([makeVerseId(1, 1, 1)]),
    })

    await panel.show('H0430')

    expect(panel.view.concordance?.familyUndifferentiated).toBe(false)
  })

  it('navigates the reader to an occurrence in the concordance\'s translation', async () => {
    const { model: panel, openReference } = concordanceModel({
      occurrences: occurrencesOf([makeVerseId(1, 1, 1)]),
    })
    await panel.show('H0430')

    panel.openOccurrence(makeVerseId(1, 1, 1))
    panel.openOccurrence(makeVerseId(1, 1, 1), { newPane: true })

    expect(openReference.mock.calls).toEqual([
      [
        { book: 1, ranges: [{ startId: 1001001, endId: 1001001 }] },
        'kjv',
        {},
      ],
      [
        { book: 1, ranges: [{ startId: 1001001, endId: 1001001 }] },
        'kjv',
        { newPane: true },
      ],
    ])
  })

  it('chips the renderings of the family, the most frequent first', async () => {
    const { model: panel } = concordanceModel({
      occurrences: occurrencesOf([
        makeVerseId(1, 1, 1),
        makeVerseId(1, 2, 4),
        makeVerseId(43, 15, 4),
      ]),
      renderings: [
        { text: 'you', verseIds: [makeVerseId(43, 15, 4)] },
        { text: 'God', verseIds: [makeVerseId(1, 1, 1), makeVerseId(1, 2, 4)] },
      ],
    })

    await panel.show('H0430')

    expect(panel.view.concordance?.renderings).toEqual([
      { text: 'God', count: 2, active: false },
      { text: 'you', count: 1, active: false },
    ])
  })

  it('filters the occurrences to a tapped rendering, counts and all', async () => {
    const { model: panel } = concordanceModel({
      occurrences: occurrencesOf([
        makeVerseId(1, 1, 1),
        makeVerseId(1, 2, 4),
        makeVerseId(43, 15, 4),
      ]),
      renderings: [
        { text: 'God', verseIds: [makeVerseId(1, 1, 1), makeVerseId(1, 2, 4)] },
        { text: 'you', verseIds: [makeVerseId(43, 15, 4)] },
      ],
    })
    await panel.show('H0430')

    panel.toggleRendering('you')

    expect(panel.view.concordance).toMatchObject({
      total: 1,
      label: 'you: 1 occurrence in KJV',
      books: [
        { book: 43, name: 'John', count: 1, expanded: false, verses: null },
      ],
      renderings: [
        { text: 'God', count: 2, active: false },
        { text: 'you', count: 1, active: true },
      ],
    })
  })

  it('clears the filter when the same rendering is tapped again', async () => {
    const { model: panel } = concordanceModel({
      occurrences: occurrencesOf([makeVerseId(1, 1, 1), makeVerseId(43, 15, 4)]),
      renderings: [
        { text: 'God', verseIds: [makeVerseId(1, 1, 1)] },
        { text: 'you', verseIds: [makeVerseId(43, 15, 4)] },
      ],
    })
    await panel.show('H0430')

    panel.toggleRendering('you')
    panel.toggleRendering('you')

    expect(panel.view.concordance).toMatchObject({
      total: 2,
      label: '2 occurrences in KJV',
      books: [{ book: 1 }, { book: 43 }],
      renderings: [
        { text: 'God', count: 1, active: false },
        { text: 'you', count: 1, active: false },
      ],
    })
  })

  it('renders the rows of a book expanded under a filter', async () => {
    const { concordance, model: panel } = concordanceModel({
      occurrences: occurrencesOf([makeVerseId(1, 1, 1), makeVerseId(1, 2, 4)]),
      renderings: [
        { text: 'God', verseIds: [makeVerseId(1, 1, 1)] },
        { text: 'LORD God', verseIds: [makeVerseId(1, 2, 4)] },
      ],
    })
    await panel.show('H0430')

    panel.toggleRendering('LORD God')
    await panel.toggleConcordanceBook(1)

    expect(concordance.asked).toEqual([
      { translationId: 'kjv', verseIds: [makeVerseId(1, 2, 4)] },
    ])
  })

  it('lets a later number win the concordance too', async () => {
    const { model: panel } = concordanceModel(
      {
        occurrences: {
          H0430: [makeVerseId(1, 1, 1), makeVerseId(1, 2, 4)],
          G3306: [makeVerseId(43, 15, 4)],
        },
      },
      { H0430: entry('H0430'), G3306: entry('G3306') },
    )

    const first = panel.show('H0430')
    const second = panel.show('G3306')
    await Promise.all([first, second])

    expect(panel.view.concordance?.total).toBe(1)
    expect(panel.view.concordance?.books[0].book).toBe(43)
  })
})

describe("WordStudyModel's translation switcher", () => {
  const switchable = () =>
    concordanceModel({
      translations: [KJV, BSB],
      perTranslation: {
        kjv: {
          occurrences: occurrencesOf([
            makeVerseId(1, 1, 1),
            makeVerseId(1, 2, 4),
          ]),
          renderings: [
            {
              text: 'God',
              verseIds: [makeVerseId(1, 1, 1), makeVerseId(1, 2, 4)],
            },
          ],
        },
        bsb: {
          occurrences: occurrencesOf([makeVerseId(43, 15, 4)]),
          renderings: [{ text: 'you', verseIds: [makeVerseId(43, 15, 4)] }],
        },
      },
    })

  it('offers every installed tagged translation to read the family in', async () => {
    const { model: panel } = switchable()

    await panel.show('H0430')

    expect(panel.view.concordance).toMatchObject({
      translations: [KJV, BSB],
      switchable: true,
    })
  })

  it('has nothing to switch between while one translation is tagged', async () => {
    const { model: panel } = concordanceModel({
      occurrences: occurrencesOf([makeVerseId(1, 1, 1)]),
    })

    await panel.show('H0430')

    expect(panel.view.concordance).toMatchObject({
      translations: [KJV],
      switchable: false,
    })
  })

  it('re-reads the family in the translation that is chosen', async () => {
    const { model: panel } = switchable()
    await panel.show('H0430')

    await panel.useTranslation('bsb')

    expect(panel.view.concordance).toMatchObject({
      translation: BSB,
      total: 1,
      label: '1 occurrence in BSB',
      books: [{ book: 43, name: 'John', count: 1 }],
      renderings: [{ text: 'you', count: 1, active: false }],
    })
  })

  it('persists the chosen translation beside the number', async () => {
    const { model: panel } = switchable()
    await panel.show('H0430')

    await panel.useTranslation('bsb')

    expect(panel.translationId).toBe('bsb')
  })

  it('drops the rendering filter when the translation changes', async () => {
    const { model: panel } = switchable()
    await panel.show('H0430')
    panel.toggleRendering('God')

    await panel.useTranslation('bsb')

    expect(panel.view.concordance?.renderings).toEqual([
      { text: 'you', count: 1, active: false },
    ])
    expect(panel.view.concordance?.total).toBe(1)
  })

  it('names the translation it can no longer read, and offers the rest', async () => {
    const { concordance, model: panel } = switchable()
    await panel.show('H0430')

    concordance.uninstall('kjv')
    await panel.useTranslation('kjv')

    expect(panel.view.concordance).toMatchObject({
      translation: null,
      translations: [BSB],
      message: 'King James Version is no longer installed.',
      switchable: true,
      label: 'Occurrences',
      total: 0,
      books: [],
      renderings: [],
    })
  })
})
