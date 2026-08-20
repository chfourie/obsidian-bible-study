import {
  NO_WORD_STUDY,
  type NavigationOptions,
  type StrongsEntryView,
  type WordStudyOpener,
} from '../contracts'

// One extended number's dictionary entry as the panel studies it: the entry
// itself, the rest of its Strong's Family, and the Strong's 1890 derivation
// the brief lexicons carry none of.
export type WordStudyEntry = {
  entry: StrongsEntryView
  siblings: string[]
  derivation: string | null
}

// The Strong's Dictionaries seen from the Word Study Panel: one entry per
// extended number, and the install the panel offers while the module is
// missing. Lookups are per number rather than per family — the family's
// concordance is a later section, not this one.
export type WordStudyDictionary = {
  installed: () => Promise<boolean>
  entryFor: (strongsNumber: string) => Promise<WordStudyEntry | null>
  install: () => Promise<void>
  attribution: string
  // Named separately because it belongs on screen only where a derivation is.
  etymologyAttribution: string
}

// Stands in when the panel runs without the dictionaries wired up: every
// number degrades to the install affordance, which installs nothing.
export const INERT_WORD_STUDY_DICTIONARY: WordStudyDictionary = {
  installed: async () => false,
  entryFor: async () => null,
  install: async () => {},
  attribution: '',
  etymologyAttribution: '',
}

export type WordStudyDeps = {
  dictionary: WordStudyDictionary
  // How the panel's own links walk: the same opener the Study Panel's entry
  // cards use, so a plain activation retargets and a modified one spawns.
  opener?: WordStudyOpener
}

// A derivation as the panel renders it: plain stretches of text, and the
// Strong's Numbers it cites, which are walkable.
export type EtymologySegment = { text: string; number: string | null }

const CITATION = /[HG]\d{4}[A-Za-z]?/g

const etymologyOf = (derivation: string | null): EtymologySegment[] | null => {
  if (derivation === null || derivation === '') return null
  const segments: EtymologySegment[] = []
  let read = 0
  for (const citation of derivation.matchAll(CITATION)) {
    const at = citation.index
    if (at > read) segments.push({ text: derivation.slice(read, at), number: null })
    segments.push({ text: citation[0], number: citation[0] })
    read = at + citation[0].length
  }
  if (read < derivation.length)
    segments.push({ text: derivation.slice(read), number: null })
  return segments
}

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
  // The rest of the entry's Strong's Family, each one walkable.
  siblings: string[]
  // Non-null exactly while the 1890 dictionary states a derivation for the
  // number under study.
  etymology: EtymologySegment[] | null
  attribution: string | null
  etymologyAttribution: string | null
  install: WordStudyInstall | null
}

const UNTITLED = 'Word study'

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export class WordStudyModel {
  #number: string | null = null
  #status: WordStudyStatus = 'empty'
  #found: WordStudyEntry | null = null
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
    const found = this.#found
    const etymology = etymologyOf(found?.derivation ?? null)
    return {
      number: this.#number,
      title: this.#number ?? UNTITLED,
      status: this.#status,
      entry: found?.entry ?? null,
      siblings: found?.siblings ?? [],
      etymology,
      attribution: found === null ? null : this.deps.dictionary.attribution,
      etymologyAttribution:
        etymology === null ? null : this.deps.dictionary.etymologyAttribution,
      install:
        this.#status === 'no-dictionary'
          ? { busy: this.#installing, error: this.#installError }
          : null,
    }
  }

  async show(strongsNumber: string): Promise<void> {
    this.#number = strongsNumber
    this.#status = 'loading'
    this.#found = null
    this.#notify()
    await this.#load()
  }

  // Walking an etymology citation or a family sibling is the same move the
  // Study Panel's entry cards make: plain retargets, modified spawns.
  async open(
    strongsNumber: string,
    options: NavigationOptions = {},
  ): Promise<void> {
    await (this.deps.opener ?? NO_WORD_STUDY).openWordStudy(strongsNumber, options)
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
      this.#found = null
      this.#notify()
      return
    }
    const found = await this.deps.dictionary.entryFor(number)
    if (token !== this.#loadToken) return
    this.#found = found
    this.#status = found === null ? 'no-entry' : 'ok'
    this.#notify()
  }

  #notify(): void {
    this.#listeners.forEach((listener) => listener())
  }
}
