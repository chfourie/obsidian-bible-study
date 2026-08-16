import { describe, expect, it } from 'vitest'
import {
  StepBibleLexiconClient,
  TBESG_URL,
  TBESH_URL,
} from './stepbible-lexicon-client'

describe('StepBibleLexiconClient', () => {
  it('fetches each lexicon from its STEPBible-Data raw URL', async () => {
    const client = new StepBibleLexiconClient(async (url) => `content of ${url}`)

    expect(await client.fetchHebrew()).toBe(`content of ${TBESH_URL}`)
    expect(await client.fetchGreek()).toBe(`content of ${TBESG_URL}`)
  })
})
