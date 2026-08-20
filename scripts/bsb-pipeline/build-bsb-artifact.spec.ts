import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MODULE_FORMAT_VERSION } from '../../src/modules/module-manifest'
import { makeVerseId } from '../../src/reference/verse-id'
import { buildBsbArtifact, sha256Hex } from './build-bsb-artifact'

const fixture = readFileSync('tests/fixtures/bsb-tables-slice.tsv', 'utf8')

describe('buildBsbArtifact', () => {
  const artifact = buildBsbArtifact(fixture)

  it('carries a manifest describing the tagged BSB module', () => {
    expect(artifact.manifest).toEqual({
      id: 'bsb',
      name: 'Berean Standard Bible',
      language: 'English',
      license: 'Public Domain',
      formatVersion: MODULE_FORMAT_VERSION,
      capabilities: {
        strongsTagged: true,
        redLetter: true,
        suppliedWords: true,
        poetry: true,
      },
    })
  })

  it('keys verse content by book number and verse id', () => {
    const genesis = artifact.books[1]
    expect(genesis[makeVerseId(1, 1, 1)].text).toBe(
      'In the beginning God created the heavens and the earth.',
    )
    expect(artifact.books[43][makeVerseId(43, 3, 16)].tags[0].strongs).toEqual([
      'G1063',
    ])
  })
})

describe('sha256Hex', () => {
  it('hashes text to lowercase hex', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
