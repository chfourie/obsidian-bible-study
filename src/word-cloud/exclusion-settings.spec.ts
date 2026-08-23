import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../data-access'
import { withWordCloudExclusion } from './exclusion-settings'

describe('withWordCloudExclusion', () => {
  it('appends the family, padded', () => {
    const settings = withWordCloudExclusion('H834')({
      ...DEFAULT_SETTINGS,
      wordCloudExclusions: ['G0026'],
    })

    expect(settings.wordCloudExclusions).toEqual(['G0026', 'H0834'])
  })

  it('leaves settings as they are when the family is already listed', () => {
    const before = { ...DEFAULT_SETTINGS, wordCloudExclusions: ['H0834'] }

    expect(withWordCloudExclusion('H834')(before)).toBe(before)
  })
})
