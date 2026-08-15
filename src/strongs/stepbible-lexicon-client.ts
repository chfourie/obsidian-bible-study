import { requestUrl } from 'obsidian'
import type { LexiconSource } from './lexicon-source'

// STEPBible's licence asks projects to distribute the data from its own
// repository rather than re-hosting it, so the lexicons download straight
// from STEPBible-Data.
const LEXICONS_BASE_URL =
  'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Lexicons'

export const TBESH_URL = `${LEXICONS_BASE_URL}/TBESH%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Hebrew%20-%20STEPBible.org%20CC%20BY.txt`

export const TBESG_URL = `${LEXICONS_BASE_URL}/TBESG%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Greek%20-%20STEPBible.org%20CC%20BY.txt`

export type TextTransport = (url: string) => Promise<string>

const requestUrlTransport: TextTransport = async (url) =>
  (await requestUrl({ url })).text

export class StepBibleLexiconClient implements LexiconSource {
  constructor(private readonly fetchText: TextTransport = requestUrlTransport) {}

  async fetchHebrew(): Promise<string> {
    return this.fetchText(TBESH_URL)
  }

  async fetchGreek(): Promise<string> {
    return this.fetchText(TBESG_URL)
  }
}
