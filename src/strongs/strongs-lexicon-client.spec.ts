import { describe, expect, it } from 'vitest'
import {
  STRONGS_GREEK_URL,
  STRONGS_HEBREW_URL,
  StrongsLexiconClient,
  TBESG_URL,
  TBESH_URL,
  TFLSJ_URLS,
} from './strongs-lexicon-client'

describe('StrongsLexiconClient', () => {
  it('fetches each lexicon from its STEPBible-Data raw URL', async () => {
    const client = new StrongsLexiconClient(async (url) => `content of ${url}`)

    expect(await client.fetchHebrew()).toBe(`content of ${TBESH_URL}`)
    expect(await client.fetchGreek()).toBe(`content of ${TBESG_URL}`)
  })

  it('fetches each 1890 dictionary from its OpenScriptures raw URL', async () => {
    const client = new StrongsLexiconClient(async (url) => `content of ${url}`)

    expect(await client.fetchHebrewDerivations()).toBe(
      `content of ${STRONGS_HEBREW_URL}`,
    )
    expect(await client.fetchGreekDerivations()).toBe(
      `content of ${STRONGS_GREEK_URL}`,
    )
  })

  it('fetches both halves of the full LSJ lexicon from STEPBible-Data', async () => {
    const client = new StrongsLexiconClient(async (url) => `content of ${url}`)

    expect(await client.fetchLsj()).toEqual(
      TFLSJ_URLS.map((url) => `content of ${url}`),
    )
    expect(TFLSJ_URLS).toHaveLength(2)
  })
})
