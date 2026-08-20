import { describe, expect, it } from 'vitest'
import { makeVerseId, type Reference } from '../reference'
import {
  CROSS_REFERENCES_FILE_NAME,
  crossReferencesFilePath,
  CrossReferenceStore,
  serializeCrossReference,
  type CrossReference,
} from './cross-reference-store'
import type { CrossReferenceVault } from './cross-reference-vault'

const reference = (
  book: number,
  ...ranges: [start: number[], end: number[]][]
): Reference => ({
  book,
  ranges: ranges.map(([start, end]) => ({
    startId: makeVerseId(book, start[0], start[1]),
    endId: makeVerseId(book, end[0], end[1]),
  })),
})

const john15Vine = reference(43, [[15, 1], [15, 8]])
const psalm80Vine = reference(19, [[80, 8], [80, 16]])
const romans11Olive = reference(45, [[11, 17], [11, 24]])

const vineCrossReference: CrossReference = {
  id: 'xr-vine',
  members: [john15Vine, psalm80Vine, romans11Olive],
  description: 'Vine and vineyard imagery for Israel',
}

const vaultWith = (files: Record<string, string>): CrossReferenceVault => ({
  read: async (path) => files[path] ?? null,
  write: async (path, content) => {
    files[path] = content
  },
  rename: async (from, to) => {
    files[to] = files[from]
    delete files[from]
  },
})

const storeOver = async (content: string): Promise<CrossReferenceStore> => {
  const store = new CrossReferenceStore(
    vaultWith({ [CROSS_REFERENCES_FILE_NAME]: content }),
  )
  await store.load()
  return store
}

const storeOverFiles = async (
  files: Record<string, string>,
  options: { newId?: () => string; filePath?: () => string } = {},
): Promise<CrossReferenceStore> => {
  const store = new CrossReferenceStore(vaultWith(files), options)
  await store.load()
  return store
}

describe('loading the cross-reference data file', () => {
  it('loads one cross-reference per line', async () => {
    const other: CrossReference = {
      id: 'xr-shepherd',
      members: [reference(19, [[23, 1], [23, 6]]), reference(43, [[10, 11], [10, 18]])],
      description: null,
    }
    const store = await storeOver(
      [vineCrossReference, other].map(serializeCrossReference).join('\n'),
    )

    expect(store.all()).toEqual([vineCrossReference, other])
  })

  it('treats a missing file as no cross-references', async () => {
    const store = new CrossReferenceStore(vaultWith({}))

    await store.load()

    expect(store.all()).toEqual([])
  })

  it('ignores blank lines and trailing newlines', async () => {
    const store = await storeOver(
      `\n${serializeCrossReference(vineCrossReference)}\n\n`,
    )

    expect(store.all()).toEqual([vineCrossReference])
  })

  it('skips lines that are not valid cross-references', async () => {
    const store = await storeOver(
      [
        'not json at all',
        '{"id":"xr-broken"}',
        serializeCrossReference(vineCrossReference),
      ].join('\n'),
    )

    expect(store.all()).toEqual([vineCrossReference])
  })

  it('reads a hand-authored entry regardless of key order', async () => {
    const line = JSON.stringify({
      description: 'Vine and vineyard imagery for Israel',
      members: [john15Vine, psalm80Vine, romans11Olive],
      id: 'xr-vine',
    })
    const store = await storeOver(line)

    expect(store.all()).toEqual([vineCrossReference])
  })

  it('defaults an omitted description to null', async () => {
    const store = await storeOver(
      JSON.stringify({ id: 'xr-bare', members: [john15Vine, psalm80Vine] }),
    )

    expect(store.all()[0].description).toBe(null)
  })
})

describe('serialization format', () => {
  it('writes stable key order with the description last', () => {
    expect(serializeCrossReference(vineCrossReference)).toBe(
      JSON.stringify({
        id: 'xr-vine',
        members: [john15Vine, psalm80Vine, romans11Olive],
        description: 'Vine and vineyard imagery for Israel',
      }),
    )
  })

  it('omits a null description', () => {
    expect(
      serializeCrossReference({ ...vineCrossReference, description: null }),
    ).toBe(
      JSON.stringify({
        id: 'xr-vine',
        members: [john15Vine, psalm80Vine, romans11Olive],
      }),
    )
  })
})

describe('intersection queries', () => {
  const loadedStore = async (): Promise<CrossReferenceStore> =>
    storeOver(serializeCrossReference(vineCrossReference))

  it('returns cross-references with a member intersecting the reference', async () => {
    const store = await loadedStore()

    expect(store.intersecting(reference(43, [[15, 4], [15, 4]]))).toEqual([
      vineCrossReference,
    ])
  })

  it('matches on boundary overlap of a single shared verse', async () => {
    const store = await loadedStore()

    expect(store.intersecting(reference(19, [[80, 1], [80, 8]]))).toEqual([
      vineCrossReference,
    ])
  })

  it('returns nothing when no member overlaps', async () => {
    const store = await loadedStore()

    expect(store.intersecting(reference(19, [[80, 1], [80, 7]]))).toEqual([])
    expect(store.intersecting(reference(43, [[15, 9], [15, 27]]))).toEqual([])
    expect(store.intersecting(reference(1, [[1, 1], [1, 31]]))).toEqual([])
  })

  it('matches through any range of a multi-range member', async () => {
    const multiRange: CrossReference = {
      id: 'xr-multi',
      members: [
        reference(43, [[15, 4], [15, 6]], [[15, 9], [15, 9]]),
        psalm80Vine,
      ],
      description: null,
    }
    const store = await storeOver(serializeCrossReference(multiRange))

    expect(store.intersecting(reference(43, [[15, 9], [15, 9]]))).toEqual([
      multiRange,
    ])
    expect(store.intersecting(reference(43, [[15, 7], [15, 8]]))).toEqual([])
  })

  it('returns every intersecting cross-reference in file order', async () => {
    const shepherd: CrossReference = {
      id: 'xr-shepherd',
      members: [reference(43, [[10, 11], [10, 18]]), reference(19, [[23, 1], [23, 6]])],
      description: null,
    }
    const johnBoth: CrossReference = {
      id: 'xr-both',
      members: [reference(43, [[15, 1], [15, 1]]), reference(66, [[22, 1], [22, 5]])],
      description: null,
    }
    const store = await storeOver(
      [vineCrossReference, shepherd, johnBoth]
        .map(serializeCrossReference)
        .join('\n'),
    )

    expect(store.intersecting(reference(43, [[15, 1], [15, 27]]))).toEqual([
      vineCrossReference,
      johnBoth,
    ])
  })
})

describe('creating a cross-reference', () => {
  it('appends the new entry to the data file and returns it', async () => {
    const files: Record<string, string> = {}
    const store = await storeOverFiles(files, { newId: () => 'xr-new' })

    const created = await store.create(
      [john15Vine, psalm80Vine],
      'Vine imagery',
    )

    expect(created).toEqual({
      id: 'xr-new',
      members: [john15Vine, psalm80Vine],
      description: 'Vine imagery',
    })
    expect(store.all()).toEqual([created])
    expect(files[CROSS_REFERENCES_FILE_NAME]).toBe(
      `${serializeCrossReference(created)}\n`,
    )
  })

  it('keeps a skipped description null and omits it from the file', async () => {
    const files: Record<string, string> = {}
    const store = await storeOverFiles(files, { newId: () => 'xr-bare' })

    await store.create([john15Vine, psalm80Vine], null)

    expect(store.all()[0].description).toBe(null)
    expect(files[CROSS_REFERENCES_FILE_NAME]).toBe(
      `${JSON.stringify({ id: 'xr-bare', members: [john15Vine, psalm80Vine] })}\n`,
    )
  })

  it('keeps existing entries in order and writes one entry per line', async () => {
    const files = {
      [CROSS_REFERENCES_FILE_NAME]: `${serializeCrossReference(vineCrossReference)}\n`,
    }
    const store = await storeOverFiles(files, { newId: () => 'xr-second' })

    await store.create([reference(19, [[23, 1], [23, 6]]), john15Vine], null)

    expect(store.all().map(({ id }) => id)).toEqual(['xr-vine', 'xr-second'])
    expect(files[CROSS_REFERENCES_FILE_NAME]).toBe(
      store
        .all()
        .map((entry) => `${serializeCrossReference(entry)}\n`)
        .join(''),
    )
  })

  it('gives each created cross-reference a distinct id by default', async () => {
    const store = await storeOverFiles({})

    const first = await store.create([john15Vine, psalm80Vine], null)
    const second = await store.create([john15Vine, romans11Olive], null)

    expect(first.id).not.toBe(second.id)
  })

  it('surfaces the new cross-reference in intersection queries at once', async () => {
    const store = await storeOverFiles({})

    await store.create([john15Vine, psalm80Vine], null)

    expect(
      store.intersecting(reference(43, [[15, 4], [15, 4]])).map(({ id }) => id),
    ).toHaveLength(1)
  })

  it('notifies change listeners', async () => {
    const store = await storeOverFiles({})
    let notified = 0
    const unsubscribe = store.onChanged(() => notified++)

    await store.create([john15Vine, psalm80Vine], null)
    expect(notified).toBe(1)

    unsubscribe()
    await store.create([john15Vine, romans11Olive], null)
    expect(notified).toBe(1)
  })
})

describe('updating members and description together', () => {
  it('replaces the member list and persists', async () => {
    const files = {
      [CROSS_REFERENCES_FILE_NAME]: `${serializeCrossReference(vineCrossReference)}\n`,
    }
    const store = await storeOverFiles(files)
    const grown = [john15Vine, psalm80Vine, romans11Olive, reference(19, [[23, 1], [23, 6]])]

    await store.update('xr-vine', grown, vineCrossReference.description)

    expect(store.all()[0].members).toEqual(grown)
    expect(files[CROSS_REFERENCES_FILE_NAME]).toBe(
      `${serializeCrossReference({ ...vineCrossReference, members: grown })}\n`,
    )
  })

  it('replaces the description alongside the members', async () => {
    const files = {
      [CROSS_REFERENCES_FILE_NAME]: `${serializeCrossReference(vineCrossReference)}\n`,
    }
    const store = await storeOverFiles(files)

    await store.update('xr-vine', [john15Vine, psalm80Vine], 'Vines only')

    expect(store.all()[0]).toEqual({
      id: 'xr-vine',
      members: [john15Vine, psalm80Vine],
      description: 'Vines only',
    })
  })

  it('writes and notifies once', async () => {
    const files = {
      [CROSS_REFERENCES_FILE_NAME]: `${serializeCrossReference(vineCrossReference)}\n`,
    }
    let writes = 0
    const vault = vaultWith(files)
    const store = new CrossReferenceStore({
      ...vault,
      write: async (path, content) => {
        writes++
        await vault.write(path, content)
      },
    })
    await store.load()
    let notified = 0
    store.onChanged(() => notified++)

    await store.update('xr-vine', [john15Vine, psalm80Vine], 'Vines only')

    expect(writes).toBe(1)
    expect(notified).toBe(1)
  })

  it('keeps the id, description, and file position stable', async () => {
    const other: CrossReference = {
      id: 'xr-shepherd',
      members: [reference(19, [[23, 1], [23, 6]]), reference(43, [[10, 11], [10, 18]])],
      description: null,
    }
    const files = {
      [CROSS_REFERENCES_FILE_NAME]: [vineCrossReference, other]
        .map(serializeCrossReference)
        .join('\n')
        .concat('\n'),
    }
    const store = await storeOverFiles(files)

    await store.update(
      'xr-vine',
      [john15Vine, romans11Olive],
      vineCrossReference.description,
    )

    expect(store.all().map(({ id }) => id)).toEqual(['xr-vine', 'xr-shepherd'])
    expect(store.all()[0]).toEqual({
      id: 'xr-vine',
      members: [john15Vine, romans11Olive],
      description: 'Vine and vineyard imagery for Israel',
    })
    expect(files[CROSS_REFERENCES_FILE_NAME]).toBe(
      store
        .all()
        .map((entry) => `${serializeCrossReference(entry)}\n`)
        .join(''),
    )
  })

  it('does nothing for an unknown id', async () => {
    const files = {
      [CROSS_REFERENCES_FILE_NAME]: `${serializeCrossReference(vineCrossReference)}\n`,
    }
    const store = await storeOverFiles(files)

    await store.update('xr-missing', [john15Vine, psalm80Vine], null)

    expect(store.all()).toEqual([vineCrossReference])
  })

  it('notifies change listeners', async () => {
    const files = {
      [CROSS_REFERENCES_FILE_NAME]: `${serializeCrossReference(vineCrossReference)}\n`,
    }
    const store = await storeOverFiles(files)
    let notified = 0
    store.onChanged(() => notified++)

    await store.update('xr-vine', [john15Vine, psalm80Vine], null)

    expect(notified).toBe(1)
  })
})

describe('deleting a cross-reference', () => {
  it('removes the entry from the data file', async () => {
    const other: CrossReference = {
      id: 'xr-shepherd',
      members: [reference(19, [[23, 1], [23, 6]]), reference(43, [[10, 11], [10, 18]])],
      description: null,
    }
    const files = {
      [CROSS_REFERENCES_FILE_NAME]: [vineCrossReference, other]
        .map(serializeCrossReference)
        .join('\n')
        .concat('\n'),
    }
    const store = await storeOverFiles(files)

    await store.delete('xr-vine')

    expect(store.all()).toEqual([other])
    expect(files[CROSS_REFERENCES_FILE_NAME]).toBe(
      `${serializeCrossReference(other)}\n`,
    )
  })

  it('does nothing for an unknown id', async () => {
    const files = {
      [CROSS_REFERENCES_FILE_NAME]: `${serializeCrossReference(vineCrossReference)}\n`,
    }
    const store = await storeOverFiles(files)

    await store.delete('xr-missing')

    expect(store.all()).toEqual([vineCrossReference])
  })

  it('notifies change listeners on a successful delete', async () => {
    const files = {
      [CROSS_REFERENCES_FILE_NAME]: `${serializeCrossReference(vineCrossReference)}\n`,
    }
    const store = await storeOverFiles(files)
    let notified = 0
    store.onChanged(() => notified++)

    await store.delete('xr-missing')
    expect(notified).toBe(0)

    await store.delete('xr-vine')
    expect(notified).toBe(1)
  })
})

describe('round-trip determinism', () => {
  it('saves unchanged content byte-identically', async () => {
    const original = [
      vineCrossReference,
      { id: 'xr-shepherd', members: [psalm80Vine, romans11Olive], description: null },
    ]
      .map(serializeCrossReference)
      .join('\n')
      .concat('\n')
    const files = { [CROSS_REFERENCES_FILE_NAME]: original }
    const store = await storeOverFiles(files)

    await store.save()

    expect(files[CROSS_REFERENCES_FILE_NAME]).toBe(original)
  })

  it('writes an empty file when there is nothing to store', async () => {
    const files: Record<string, string> = {}
    const store = await storeOverFiles(files)

    await store.save()

    expect(files[CROSS_REFERENCES_FILE_NAME]).toBe('')
  })
})

describe('configurable file path', () => {
  it('builds the path from the configured folder', () => {
    expect(crossReferencesFilePath('')).toBe(CROSS_REFERENCES_FILE_NAME)
    expect(crossReferencesFilePath('Study/Data')).toBe(
      `Study/Data/${CROSS_REFERENCES_FILE_NAME}`,
    )
  })

  it('reads and writes through the provided path', async () => {
    const path = `Study/Data/${CROSS_REFERENCES_FILE_NAME}`
    const files: Record<string, string> = {
      [path]: serializeCrossReference(vineCrossReference),
    }
    const store = await storeOverFiles(files, {
      newId: () => 'xr-new',
      filePath: () => path,
    })

    expect(store.all()).toEqual([vineCrossReference])

    await store.create([john15Vine, psalm80Vine], null)
    expect(files[path].split('\n').filter((line) => line !== '')).toHaveLength(2)
    expect(files[CROSS_REFERENCES_FILE_NAME]).toBeUndefined()
  })

  it('follows a path change on the next load and save', async () => {
    let path = CROSS_REFERENCES_FILE_NAME
    const moved = `Study/${CROSS_REFERENCES_FILE_NAME}`
    const files = {
      [CROSS_REFERENCES_FILE_NAME]: serializeCrossReference(vineCrossReference),
      [moved]: '',
    }
    const store = await storeOverFiles(files, { filePath: () => path })
    expect(store.all()).toEqual([vineCrossReference])

    path = moved
    await store.load()
    expect(store.all()).toEqual([])

    await store.save()
    expect(files[moved]).toBe('')
    expect(files[CROSS_REFERENCES_FILE_NAME]).toBe(
      serializeCrossReference(vineCrossReference),
    )
  })
})

describe('members of a book that is not installed', () => {
  const mixed: CrossReference = {
    id: 'xr-pride',
    members: [john15Vine, reference(101, [[1, 2], [1, 2]])],
    description: 'Pride and its cure',
  }

  // Members are plain verse ids, so an entry naming a book survives the
  // module's absence untouched — dormant, never deleted (spec-books §6).
  it('round-trips a book member with no book registered at all', async () => {
    const files: Record<string, string> = {
      [CROSS_REFERENCES_FILE_NAME]: `${serializeCrossReference(mixed)}\n`,
    }
    const store = await storeOverFiles(files)

    expect(store.all()).toEqual([mixed])

    await store.save()
    expect(files[CROSS_REFERENCES_FILE_NAME]).toBe(
      `${serializeCrossReference(mixed)}\n`,
    )
  })
})
