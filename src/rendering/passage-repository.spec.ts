import { describe, expect, it } from 'vitest'
import { parseReference, type Reference } from '../reference'
import type { Passage, PassageSource } from './module-passage-source'
import { PassageRepository } from './passage-repository'

const ref = (text: string): Reference => {
  const parsed = parseReference(text)
  if (!parsed) throw new Error(`unparseable: ${text}`)
  return parsed.reference
}

const okPassage = (): Passage => ({
  status: 'ok',
  verses: [],
  attribution: null,
})

const countingSource = (results: () => Passage) => {
  let calls = 0
  const source: PassageSource = {
    passage: async () => {
      calls++
      return results()
    },
  }
  return { source, calls: () => calls }
}

describe('PassageRepository', () => {
  it('serves a passage from its source', async () => {
    const { source } = countingSource(okPassage)
    const repository = new PassageRepository(source)

    expect(await repository.passage(ref('John 15:4'), 'web')).toEqual(
      okPassage(),
    )
  })

  it('fetches each translation-reference pair only once', async () => {
    const { source, calls } = countingSource(okPassage)
    const repository = new PassageRepository(source)

    await Promise.all([
      repository.passage(ref('John 15:4'), 'web'),
      repository.passage(ref('John 15:4'), 'web'),
    ])
    await repository.passage(ref('John 15:4'), 'web')
    await repository.passage(ref('John 15:4'), 'kjv')
    await repository.passage(ref('John 15:9'), 'web')

    expect(calls()).toBe(3)
  })

  it('retries unavailable passages on the next request', async () => {
    let available = false
    const { source, calls } = countingSource(() =>
      available ? okPassage() : { status: 'unavailable' },
    )
    const repository = new PassageRepository(source)

    expect(await repository.passage(ref('John 15:4'), 'web')).toEqual({
      status: 'unavailable',
    })
    available = true
    expect(await repository.passage(ref('John 15:4'), 'web')).toEqual(
      okPassage(),
    )
    expect(calls()).toBe(2)
  })

  it('treats a source failure as unavailable and retries later', async () => {
    let failing = true
    const source: PassageSource = {
      passage: async () => {
        if (failing) throw new Error('disk error')
        return okPassage()
      },
    }
    const repository = new PassageRepository(source)

    expect(await repository.passage(ref('John 15:4'), 'web')).toEqual({
      status: 'unavailable',
    })
    failing = false
    expect(await repository.passage(ref('John 15:4'), 'web')).toEqual(
      okPassage(),
    )
  })

  it('forgets cached passages when cleared', async () => {
    const { source, calls } = countingSource(okPassage)
    const repository = new PassageRepository(source)

    await repository.passage(ref('John 15:4'), 'web')
    repository.clear()
    await repository.passage(ref('John 15:4'), 'web')

    expect(calls()).toBe(2)
  })
})
