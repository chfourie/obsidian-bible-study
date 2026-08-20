import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import { BSB_RELEASE } from './bsb-release'
import { BOOK_CATALOGUE, bookRelease } from './book-catalogue'
import {
  PrebuiltReleaseClient,
  releaseArtifactUrl,
  releaseChecksumsUrl,
} from './prebuilt-release-client'

const bsbArtifact = {
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

const humilityArtifact = {
  manifest: {
    id: 'hum-m1895',
    name: 'Humility',
    language: 'English',
    license: 'Public Domain',
    formatVersion: 2,
    kind: 'book',
    capabilities: { strongsTagged: false },
    book: {
      number: 101,
      editionCode: 'HUM-M1895',
      author: 'Andrew Murray',
      year: 1895,
      abbreviation: 'Hum',
      sections: [{ chapter: 0, name: 'Preface', paragraphs: 2 }],
    },
  },
  books: {
    101: { [makeVerseId(101, 0, 1)]: { text: 'In the Preface.' } },
  },
  epigraphs: {},
}

const HUMILITY_RELEASE = bookRelease(BOOK_CATALOGUE[0])

const sha256 = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex')

const clientFor = (
  release: typeof BSB_RELEASE,
  artifact: unknown,
  checksums: Record<string, string>,
) => {
  const json = JSON.stringify(artifact)
  const responses: Record<string, string> = {
    [releaseArtifactUrl(release)]: json,
    [releaseChecksumsUrl(release)]: JSON.stringify(checksums),
  }
  const client = new PrebuiltReleaseClient(release, async (url) => {
    const response = responses[url]
    if (response === undefined) throw new Error(`unexpected fetch: ${url}`)
    return response
  })
  return { client, json, checksum: sha256(json) }
}

describe('release URLs', () => {
  it('addresses each module release by its own tag and filename', () => {
    expect(releaseArtifactUrl(BSB_RELEASE)).toBe(
      'https://github.com/chfourie/obsidian-bible-study/releases/download/bsb-module/bsb-module.json',
    )
    expect(releaseArtifactUrl(HUMILITY_RELEASE)).toBe(
      'https://github.com/chfourie/obsidian-bible-study/releases/download/hum-m1895-module/hum-m1895-module.json',
    )
    expect(releaseChecksumsUrl(HUMILITY_RELEASE)).toBe(
      'https://github.com/chfourie/obsidian-bible-study/releases/download/hum-m1895-module/checksums.json',
    )
  })
})

describe('PrebuiltReleaseClient fetchModule', () => {
  it('parses the BSB release artifact into a normalized tagged module', async () => {
    const { client, checksum } = clientFor(BSB_RELEASE, bsbArtifact, {
      bsb: sha256(JSON.stringify(bsbArtifact)),
    })

    const download = await client.fetchModule()

    expect(download.checksum).toBe(checksum)
    expect(download.module.manifest).toEqual({
      ...bsbArtifact.manifest,
      source: releaseArtifactUrl(BSB_RELEASE),
      sourceChecksum: checksum,
    })
    expect(download.module.books.get(43)).toEqual(bsbArtifact.books[43])
  })

  it('parses a book release artifact, keeping its kind and book metadata', async () => {
    const { client, checksum } = clientFor(HUMILITY_RELEASE, humilityArtifact, {
      'hum-m1895': sha256(JSON.stringify(humilityArtifact)),
    })

    const download = await client.fetchModule()

    expect(download.module.manifest).toEqual({
      ...humilityArtifact.manifest,
      source: releaseArtifactUrl(HUMILITY_RELEASE),
      sourceChecksum: checksum,
    })
    expect(download.module.books.get(101)).toEqual(humilityArtifact.books[101])
  })
})

describe('PrebuiltReleaseClient fetchChecksum', () => {
  it('serves the published checksum keyed by the module id', async () => {
    const { client, checksum } = clientFor(HUMILITY_RELEASE, humilityArtifact, {
      bsb: 'other',
      'hum-m1895': sha256(JSON.stringify(humilityArtifact)),
    })

    expect(await client.fetchChecksum()).toBe(checksum)
  })

  it('serves null when the checksums file lacks an entry for the module', async () => {
    const { client } = clientFor(BSB_RELEASE, bsbArtifact, {})

    expect(await client.fetchChecksum()).toBeNull()
  })
})
