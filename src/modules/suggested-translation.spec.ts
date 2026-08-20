import { describe, expect, it } from 'vitest'
import { BSB_MODULE_ID } from './bsb-release'
import { SUGGESTED_FIRST_TRANSLATION } from './suggested-translation'

describe('first-run suggested translation', () => {
  it('suggests the tagged BSB release module for one-click install', () => {
    expect(SUGGESTED_FIRST_TRANSLATION).toEqual({
      id: BSB_MODULE_ID,
      name: 'Berean Standard Bible',
    })
  })
})
