import { requestUrl } from 'obsidian'
import type { LexiconSource } from './lexicon-source'
import type { LsjSource } from './lsj-source'

// STEPBible's licence asks projects to distribute the data from its own
// repository rather than re-hosting it, so the lexicons download straight
// from STEPBible-Data.
const LEXICONS_BASE_URL =
  'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Lexicons'

export const TBESH_URL = `${LEXICONS_BASE_URL}/TBESH%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Hebrew%20-%20STEPBible.org%20CC%20BY.txt`

export const TBESG_URL = `${LEXICONS_BASE_URL}/TBESG%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Greek%20-%20STEPBible.org%20CC%20BY.txt`

// The full Liddell-Scott-Jones lexicon, published in two halves: the Strong's
// range, and the extra numbers STEPBible added for words Strong never gave one.
export const TFLSJ_URLS = [
  `${LEXICONS_BASE_URL}/TFLSJ%20%200-5624%20-%20Translators%20Formatted%20full%20LSJ%20Bible%20lexicon%20-%20STEPBible.org%20CC%20BY.txt`,
  `${LEXICONS_BASE_URL}/TFLSJ%20extra%20-%20Translators%20Formatted%20full%20LSJ%20Bible%20lexicon%20-%20STEPBible.org%20CC%20BY.txt`,
]

// The etymology layer comes from OpenScriptures, one repository per language.
// Hebrew is taken from HebrewLexicon, released under CC BY 4.0. Greek is taken
// from the XML edition in openscriptures/strongs rather than that repository's
// JS build, which claims CC BY-SA over the same public-domain 1890 text.
export const STRONGS_HEBREW_URL =
  'https://raw.githubusercontent.com/openscriptures/HebrewLexicon/master/HebrewStrong.xml'

export const STRONGS_GREEK_URL =
  'https://raw.githubusercontent.com/openscriptures/strongs/master/greek/StrongsGreekDictionaryXML_1.4/strongsgreek.xml'

export type TextTransport = (url: string) => Promise<string>

const requestUrlTransport: TextTransport = async (url) =>
  (await requestUrl({ url })).text

export class StrongsLexiconClient implements LexiconSource, LsjSource {
  constructor(private readonly fetchText: TextTransport = requestUrlTransport) {}

  async fetchHebrew(): Promise<string> {
    return this.fetchText(TBESH_URL)
  }

  async fetchGreek(): Promise<string> {
    return this.fetchText(TBESG_URL)
  }

  async fetchLsj(): Promise<string[]> {
    return Promise.all(TFLSJ_URLS.map((url) => this.fetchText(url)))
  }

  async fetchHebrewDerivations(): Promise<string> {
    return this.fetchText(STRONGS_HEBREW_URL)
  }

  async fetchGreekDerivations(): Promise<string> {
    return this.fetchText(STRONGS_GREEK_URL)
  }
}
