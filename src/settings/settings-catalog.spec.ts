import { describe, expect, it } from 'vitest'
import { settingsCatalog } from './settings-catalog'

describe('settingsCatalog', () => {
  it('merges the getBible catalog with the tagged BSB release entry', async () => {
    const catalog = settingsCatalog(async () => [
      { id: 'web', name: 'World English Bible', language: 'English' },
    ])

    expect(await catalog()).toEqual([
      { id: 'web', name: 'World English Bible', language: 'English' },
      {
        id: 'bsb',
        name: 'Berean Standard Bible',
        language: 'English',
        strongsTagged: true,
      },
    ])
  })

  it('degrades to the static entries when the catalog fetch fails', async () => {
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
