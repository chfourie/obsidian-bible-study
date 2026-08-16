import { beforeEach, describe, expect, it } from 'vitest'
import { removeLegacyOnlineTierArtifacts } from './legacy-online-tier-cleanup'
import type { ModuleDataDir } from './module-data-dir'

class FakeModuleDataDir implements ModuleDataDir {
  readonly files = new Map<string, string>()

  async readTextFile(path: string): Promise<string | null> {
    return this.files.get(path) ?? null
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    this.files.set(path, content)
  }

  async removeDir(path: string): Promise<void> {
    for (const file of [...this.files.keys()]) {
      if (file.startsWith(`${path}/`)) this.files.delete(file)
    }
  }

  async listDirs(): Promise<string[]> {
    return []
  }
}

const FUMS_DEVICE_ID_KEY = 'scripture-study-fums-device-id'

describe('removeLegacyOnlineTierArtifacts', () => {
  beforeEach(() => window.localStorage.clear())

  it('removes the orphaned passage cache dir, leaving modules intact', async () => {
    const dataDir = new FakeModuleDataDir()
    dataDir.files.set('cache/nkjv/043015004-043015006.json', '{}')
    dataDir.files.set('modules/web/manifest.json', '{}')

    await removeLegacyOnlineTierArtifacts(dataDir)

    expect([...dataDir.files.keys()]).toEqual(['modules/web/manifest.json'])
  })

  it('removes the orphaned FUMS device id from localStorage', async () => {
    window.localStorage.setItem(FUMS_DEVICE_ID_KEY, 'device-1')

    await removeLegacyOnlineTierArtifacts(new FakeModuleDataDir())

    expect(window.localStorage.getItem(FUMS_DEVICE_ID_KEY)).toBe(null)
  })

  it('is a no-op when nothing legacy is present', async () => {
    await expect(
      removeLegacyOnlineTierArtifacts(new FakeModuleDataDir()),
    ).resolves.toBeUndefined()
  })

  it('swallows filesystem errors and still clears localStorage', async () => {
    window.localStorage.setItem(FUMS_DEVICE_ID_KEY, 'device-1')
    const failing = new FakeModuleDataDir()
    failing.removeDir = async () => {
      throw new Error('disk gone')
    }

    await expect(
      removeLegacyOnlineTierArtifacts(failing),
    ).resolves.toBeUndefined()
    expect(window.localStorage.getItem(FUMS_DEVICE_ID_KEY)).toBe(null)
  })
})
