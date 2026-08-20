import type { StrongsEntryView } from '../contracts'

// The Strong's Dictionaries seen from the Word Study Panel: one entry per
// extended number, and the install the panel offers while the module is
// missing. Lookups are per number rather than per family — the family's
// concordance is a later section, not this one.
export type WordStudyDictionary = {
  installed: () => Promise<boolean>
  entryFor: (strongsNumber: string) => Promise<StrongsEntryView | null>
  install: () => Promise<void>
  attribution: string
}

// Stands in when the panel runs without the dictionaries wired up: every
// number degrades to the install affordance, which installs nothing.
export const INERT_WORD_STUDY_DICTIONARY: WordStudyDictionary = {
  installed: async () => false,
  entryFor: async () => null,
  install: async () => {},
  attribution: '',
}

export type WordStudyDeps = { dictionary: WordStudyDictionary }

export type WordStudyStatus =
  // A panel restored without a number, or one never given one.
  | 'empty'
  | 'loading'
  | 'ok'
  // The number is well-formed but the dictionaries carry no entry for it.
  | 'no-entry'
  // The Strong's Dictionaries module is not installed — as after a layout
  // restore on a vault that never had it.
  | 'no-dictionary'

// The install the panel offers in place of the dictionary area, non-null
// exactly while the status is 'no-dictionary'.
export type WordStudyInstall = { busy: boolean; error: string | null }

export type WordStudyViewState = {
  number: string | null
  // Names the tab: the number under study, until there is one.
  title: string
  status: WordStudyStatus
  entry: StrongsEntryView | null
  attribution: string | null
  install: WordStudyInstall | null
}

const UNTITLED = 'Word study'

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export class WordStudyModel {
  #number: string | null = null
  #status: WordStudyStatus = 'empty'
  #entry: StrongsEntryView | null = null
  #installing = false
  #installError: string | null = null
  #loadToken = 0
  readonly #listeners = new Set<() => void>()

  constructor(private readonly deps: WordStudyDeps) {}

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  // The number the panel persists, so a restored tab comes back to it.
  get number(): string | null {
    return this.#number
  }

  get view(): WordStudyViewState {
    return {
      number: this.#number,
      title: this.#number ?? UNTITLED,
      status: this.#status,
      entry: this.#entry,
      attribution: this.#entry === null ? null : this.deps.dictionary.attribution,
      install:
        this.#status === 'no-dictionary'
          ? { busy: this.#installing, error: this.#installError }
          : null,
    }
  }

  async show(strongsNumber: string): Promise<void> {
    this.#number = strongsNumber
    this.#status = 'loading'
    this.#entry = null
    this.#notify()
    await this.#load()
  }

  async installDictionary(): Promise<void> {
    if (this.#installing) return
    this.#installing = true
    this.#installError = null
    this.#notify()
    try {
      await this.deps.dictionary.install()
    } catch (error) {
      this.#installing = false
      this.#installError = errorMessage(error)
      this.#notify()
      return
    }
    this.#installing = false
    await this.#load()
  }

  // A number that arrived while an earlier one was still loading wins: only
  // the newest token is allowed to settle the panel.
  async #load(): Promise<void> {
    const number = this.#number
    if (number === null) return
    const token = ++this.#loadToken
    if (!(await this.deps.dictionary.installed())) {
      if (token !== this.#loadToken) return
      this.#status = 'no-dictionary'
      this.#entry = null
      this.#notify()
      return
    }
    const entry = await this.deps.dictionary.entryFor(number)
    if (token !== this.#loadToken) return
    this.#entry = entry
    this.#status = entry === null ? 'no-entry' : 'ok'
    this.#notify()
  }

  #notify(): void {
    this.#listeners.forEach((listener) => listener())
  }
}
