import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../data-access'
import { makeVerseId, type Reference } from '../reference'
import {
  FallbackPassageSource,
  resolveFallbackTranslationId,
} from './fallback-passage-source'
import type { Passage, PassageSource } from './module-passage-source'

const JOHN_15_4 = makeVerseId(43, 15, 4)

const john15_4: Reference = {
  book: 43,
  ranges: [{ startId: JOHN_15_4, endId: JOHN_15_4 }],
}

const okPassage = (text: string): Passage => ({
  status: 'ok',
  verses: [{ verseId: JOHN_15_4, segments: [{ text, redLetter: false }] }],
  attribution: null,
})

const sourceOf = (passages: Record<string, Passage>) => {
  const requested: string[] = []
  const source: PassageSource = {
    passage: async (_reference, translationId) => {
      requested.push(translationId)
      return passages[translationId] ?? { status: 'unavailable' }
    },
  }
  return { source, requested }
}

describe('FallbackPassageSource', () => {
  it('serves the requested translation untouched when available', async () => {
    const { source } = sourceOf({ nkjv: okPassage('NKJV text') })
    const fallback = new FallbackPassageSource(source, () => 'web')

    expect(await fallback.passage(john15_4, 'nkjv')).toEqual(
      okPassage('NKJV text'),
    )
  })

  it('serves the fallback translation marked with what was requested', async () => {
    const { source } = sourceOf({ web: okPassage('WEB text') })
    const fallback = new FallbackPassageSource(source, () => 'web')

    expect(await fallback.passage(john15_4, 'nkjv')).toEqual({
      ...okPassage('WEB text'),
      fallback: { requested: 'nkjv', served: 'web' },
    })
  })

  it('stays unavailable when no fallback translation is configured', async () => {
    const { source, requested } = sourceOf({})
    const fallback = new FallbackPassageSource(source, () => null)

    expect(await fallback.passage(john15_4, 'nkjv')).toEqual({
      status: 'unavailable',
    })
    expect(requested).toEqual(['nkjv'])
  })

  it('does not retry the requested translation as its own fallback', async () => {
    const { source, requested } = sourceOf({})
    const fallback = new FallbackPassageSource(source, () => 'nkjv')

    expect(await fallback.passage(john15_4, 'nkjv')).toEqual({
      status: 'unavailable',
    })
    expect(requested).toEqual(['nkjv'])
  })

  it('stays unavailable when the fallback translation is unavailable too', async () => {
    const { source } = sourceOf({})
    const fallback = new FallbackPassageSource(source, () => 'web')

    expect(await fallback.passage(john15_4, 'nkjv')).toEqual({
      status: 'unavailable',
    })
  })

  // A book has one edition; no translation can stand in for its module.
  it('never substitutes a translation for a book', async () => {
    const humility2_2 = makeVerseId(101, 2, 2)
    const { source, requested } = sourceOf({ web: okPassage('WEB text') })
    const fallback = new FallbackPassageSource(source, () => 'web')

    expect(
      await fallback.passage(
        { book: 101, ranges: [{ startId: humility2_2, endId: humility2_2 }] },
        'hum-m1895',
      ),
    ).toEqual({ status: 'unavailable' })
    expect(requested).toEqual(['hum-m1895'])
  })
})

describe('resolveFallbackTranslationId', () => {
  it('uses the configured fallback when it is an installed module', () => {
    expect(
      resolveFallbackTranslationId({
        ...DEFAULT_SETTINGS,
        installedModuleIds: ['web', 'kjv'],
        fallbackTranslationId: 'kjv',
      }),
    ).toBe('kjv')
  })

  it('defaults to the first installed module when none is configured', () => {
    expect(
      resolveFallbackTranslationId({
        ...DEFAULT_SETTINGS,
        installedModuleIds: ['web', 'kjv'],
        fallbackTranslationId: null,
      }),
    ).toBe('web')
  })

  it('ignores a configured fallback that is no longer installed', () => {
    expect(
      resolveFallbackTranslationId({
        ...DEFAULT_SETTINGS,
        installedModuleIds: ['web'],
        fallbackTranslationId: 'kjv',
      }),
    ).toBe('web')
  })

  it('resolves to none when no modules are installed', () => {
    expect(
      resolveFallbackTranslationId({
        ...DEFAULT_SETTINGS,
        installedModuleIds: [],
        fallbackTranslationId: 'kjv',
      }),
    ).toBeNull()
  })
})
