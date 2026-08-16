import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import {
  BSB_ARTIFACT_URL,
  BSB_CHECKSUMS_URL,
  BsbReleaseClient,
} from './bsb-release-client'

const artifact = {
  manifest: {
    id: 'bsb',
    name: 'Berean Standard Bible',
    language: 'English',
    license: 'Public Domain',
    formatVersion: 1,
    capabilities: { strongsTagged: true },
  },
  books: {
    43: {
      [makeVerseId(43, 15, 4)]: {
        text: 'Remain in Me, and I in you.',
        tags: [{ start: 0, end: 6, strongs: ['G3306'] }],
      },
    },
  },
}

const artifactJson = JSON.stringify(artifact)
const artifactSha256 = createHash('sha256')
  .update(artifactJson, 'utf8')
  .digest('hex')

const client = (
  responses: Record<string, string> = {
    [BSB_ARTIFACT_URL]: artifactJson,
    [BSB_CHECKSUMS_URL]: JSON.stringify({ bsb: artifactSha256 }),
  },
) =>
  new BsbReleaseClient(async (url) => {
    const response = responses[url]
    if (response === undefined) throw new Error(`unexpected fetch: ${url}`)
    return response
  })

describe('BsbReleaseClient fetchModule', () => {
  it('parses the release artifact into a normalized tagged module', async () => {
    const download = await client().fetchModule()

    expect(download.checksum).toBe(artifactSha256)
    expect(download.module.manifest).toEqual({
      ...artifact.manifest,
      source: BSB_ARTIFACT_URL,
      sourceChecksum: artifactSha256,
    })
    expect(download.module.books.get(43)).toEqual(artifact.books[43])
  })
})

describe('BsbReleaseClient fetchChecksum', () => {
  it('serves the published bsb checksum', async () => {
    expect(await client().fetchChecksum()).toBe(artifactSha256)
  })

  it('serves null when the checksums file lacks a bsb entry', async () => {
    const withoutEntry = client({
      [BSB_ARTIFACT_URL]: artifactJson,
      [BSB_CHECKSUMS_URL]: JSON.stringify({}),
    })

    expect(await withoutEntry.fetchChecksum()).toBeNull()
  })
})
