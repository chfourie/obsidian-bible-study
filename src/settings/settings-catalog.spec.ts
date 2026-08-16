import { describe, expect, it } from 'vitest'
import { settingsCatalog } from './settings-catalog'

describe('settingsCatalog', () => {
  it('lists the bolls catalogue plus the tagged BSB release entry', async () => {
    const catalog = settingsCatalog(async () => [
      { id: 'web', name: 'World English Bible', language: 'English' },
      { id: 'aov', name: 'Afrikaanse Ou Vertaling 1933/1953', language: 'Afrikaans' },
    ])

    expect(await catalog()).toEqual([
      { id: 'web', name: 'World English Bible', language: 'English' },
      {
        id: 'aov',
        name: 'Afrikaanse Ou Vertaling 1933/1953',
        language: 'Afrikaans',
      },
      {
        id: 'bsb',
        name: 'Berean Standard Bible',
        language: 'English',
        strongsTagged: true,
      },
    ])
  })

  it('badges KJV as Strong\'s-tagged', async () => {
    const catalog = settingsCatalog(async () => [
      { id: 'kjv', name: 'King James Version', language: 'English' },
    ])

    expect(await catalog()).toContainEqual({
      id: 'kjv',
      name: 'King James Version',
      language: 'English',
      strongsTagged: true,
    })
  })

  it('serves BSB only from the release artifact, dropping the bolls BSB row', async () => {
    const catalog = settingsCatalog(async () => [
      { id: 'bsb', name: 'Berean Study Bible', language: 'English' },
    ])

    expect(await catalog()).toEqual([
      {
        id: 'bsb',
        name: 'Berean Standard Bible',
        language: 'English',
        strongsTagged: true,
      },
    ])
  })

  it('degrades to the static entries when the catalogue fetch fails', async () => {
    const catalog = settingsCatalog(async () => {
      throw new Error('offline')
    })

    expect(await catalog()).toEqual([
      {
        id: 'bsb',
        name: 'Berean Standard Bible',
        language: 'English',
        strongsTagged: true,
      },
    ])
  })
})
