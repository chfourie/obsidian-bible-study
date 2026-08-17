import { createHash } from 'node:crypto'
import {
  MODULE_FORMAT_VERSION,
  type ModuleCapabilities,
} from '../../src/modules/module-manifest'
import type { TaggedVerse } from '../../src/modules/verse-content'
import { parseBsbTables } from './parse-bsb-tables'

export type BsbArtifactManifest = {
  id: string
  name: string
  language: string
  license: string
  formatVersion: number
  capabilities: ModuleCapabilities
}

export type BsbArtifact = {
  manifest: BsbArtifactManifest
  books: Record<number, Record<number, TaggedVerse>>
}

export const buildBsbArtifact = (tsv: string): BsbArtifact => ({
  manifest: {
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
  },
  books: Object.fromEntries(parseBsbTables(tsv)),
})

export const sha256Hex = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex')
