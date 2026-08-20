import { describe, expect, it, vi } from 'vitest'
import type { StrongsEntryView } from '../contracts'
import { WordStudyModel, type WordStudyEntry } from './word-study-model'

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
