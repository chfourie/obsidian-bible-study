import { describe, expect, it } from 'vitest'
import type { StrongsEntryView } from '../contracts'
import { WordStudyModel } from './word-study-model'

const entry = (strongs: string): StrongsEntryView => ({
  strongs,
  lemma: 'ἀγάπη',
  transliteration: 'agapē',
  gloss: 'love',
  definition: 'love, affection, benevolence',
})

// The dictionary module seen through the word study's own seam: installed or
// not, and one entry per extended number.
const fakeDictionary = (
  entries: Record<string, StrongsEntryView> = {},
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
    },
  }
}

const model = (...args: Parameters<typeof fakeDictionary>) => {
  const dictionary = fakeDictionary(...args)
  return { dictionary, model: new WordStudyModel({ dictionary: dictionary.deps }) }
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
        lemma: 'ἀγάπη',
        transliteration: 'agapē',
        gloss: 'love',
        definition: 'love, affection, benevolence',
      },
      attribution: 'Dictionary data: TBESH/TBESG (CC BY 4.0)',
      install: null,
    })
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
