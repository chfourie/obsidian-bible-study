import { describe, expect, it } from 'vitest'
import { enumerateVerseIds, makeVerseId, type Reference } from '../reference'
import type { Passage, PassageSource } from '../rendering'
import { ReferencesPanelModel } from './references-panel-model'

type PassageRequest = { reference: Reference; translationId: string }

const versesFor = (reference: Reference): Passage => ({
  status: 'ok',
  verses: reference.ranges.flatMap((range) =>
    enumerateVerseIds(range).map((verseId) => ({
      verseId,
      segments: [{ text: `text-${verseId}`, redLetter: false }],
    })),
  ),
  attribution: null,
})

const fakeSource = () => {
  const requests: PassageRequest[] = []
  let respond: (reference: Reference) => Passage = versesFor
  const source: PassageSource = {
    passage: async (reference, translationId) => {
      requests.push({ reference, translationId })
      return respond(reference)
    },
  }
  return {
    source,
    requests,
    useResponse: (fn: (reference: Reference) => Passage) => {
      respond = fn
    },
  }
}

const model = (
  source: PassageSource,
  translationId: string | null = 'web',
): ReferencesPanelModel =>
  new ReferencesPanelModel({ passages: source }, { translationId })

describe('ReferencesPanelModel', () => {
  it('starts with no note', () => {
    const panel = model(fakeSource().source)

    expect(panel.view).toEqual({ file: null, status: 'no-note', entries: [] })
  })

  it('lists unique references in order of appearance with passage text', async () => {
    const panel = model(fakeSource().source)

    await panel.setActiveNote({
      file: 'Sermons/Vine.md',
      content: 'On {John 15:1} and {Genesis 1:1}.',
    })

    expect(panel.view.file).toBe('Sermons/Vine.md')
    expect(panel.view.status).toBe('ok')
    expect(panel.view.entries.map((entry) => entry.label)).toEqual([
      'John 15:1',
      'Genesis 1:1',
    ])
    expect(panel.view.entries[0].status).toBe('ok')
    expect(panel.view.entries[0].verses).toEqual([
      { label: null, text: `text-${makeVerseId(43, 15, 1)}` },
    ])
  })

  it('dedupes repeated references, keeping the first position', async () => {
    const panel = model(fakeSource().source)

    await panel.setActiveNote({
      file: 'note.md',
      content: '{John 15:1} then {Genesis 1:1} then {John 15:1} again',
    })

    expect(panel.view.entries.map((entry) => entry.label)).toEqual([
      'John 15:1',
      'Genesis 1:1',
    ])
  })

  it('combines a reference contained by an earlier one into a single entry', async () => {
    const panel = model(fakeSource().source)

    await panel.setActiveNote({
      file: 'note.md',
      content: '{Psalms 25:1-5} then {Psalms 25:4}',
    })

    expect(panel.view.entries.map((entry) => entry.label)).toEqual([
      'Psalms 25:1-5',
    ])
  })

  it('combines overlapping references into their union', async () => {
    const panel = model(fakeSource().source)

    await panel.setActiveNote({
      file: 'note.md',
      content: '{Psalms 25:1-3} and {Psalms 25:2-6}',
    })

    expect(panel.view.entries.map((entry) => entry.label)).toEqual([
      'Psalms 25:1-6',
    ])
  })

  it('folds entries together when a later reference bridges them', async () => {
    const panel = model(fakeSource().source)

    await panel.setActiveNote({
      file: 'note.md',
      content: '{Psalms 25:1-2} {Psalms 25:5-6} {Psalms 25:2-5}',
    })

    expect(panel.view.entries.map((entry) => entry.label)).toEqual([
      'Psalms 25:1-6',
    ])
  })

  it('keeps non-intersecting references separate', async () => {
    const panel = model(fakeSource().source)

    await panel.setActiveNote({
      file: 'note.md',
      content: '{Psalms 25:1-2} and {Psalms 25:7-8} and {John 15:1}',
    })

    expect(panel.view.entries.map((entry) => entry.label)).toEqual([
      'Psalms 25:1-2',
      'Psalms 25:7-8',
      'John 15:1',
    ])
  })

  it('includes the annotation frontmatter reference first', async () => {
    const panel = model(fakeSource().source)

    await panel.setActiveNote({
      file: 'Annotations/John 15.1.md',
      content: '---\nref: John 15:1\n---\nSee also {Genesis 1:1}.',
    })

    expect(panel.view.entries.map((entry) => entry.label)).toEqual([
      'John 15:1',
      'Genesis 1:1',
    ])
  })

  it('labels verses when an entry spans multiple verses', async () => {
    const panel = model(fakeSource().source)

    await panel.setActiveNote({ file: 'note.md', content: '{John 15:1-2}' })

    expect(panel.view.entries[0].verses.map((verse) => verse.label)).toEqual([
      '1',
      '2',
    ])
  })

  it('chapter-qualifies labels when an entry spans chapters', async () => {
    const panel = model(fakeSource().source)

    await panel.setActiveNote({ file: 'note.md', content: '{John 15:26-16:2}' })

    expect(panel.view.entries[0].verses.map((verse) => verse.label)).toEqual([
      '15:26',
      '15:27',
      '16:1',
      '16:2',
    ])
  })

  it('reports a note without references', async () => {
    const panel = model(fakeSource().source)

    await panel.setActiveNote({ file: 'plain.md', content: 'No refs here.' })

    expect(panel.view.status).toBe('no-references')
    expect(panel.view.entries).toEqual([])
  })

  it('reports no-translation without loading passages', async () => {
    const fake = fakeSource()
    const panel = model(fake.source, null)

    await panel.setActiveNote({ file: 'note.md', content: '{John 15:1}' })

    expect(panel.view.status).toBe('no-translation')
    expect(panel.view.entries[0].status).toBe('unavailable')
    expect(fake.requests).toEqual([])
  })

  it('marks entries whose passage is unavailable', async () => {
    const fake = fakeSource()
    fake.useResponse(() => ({ status: 'unavailable' }))
    const panel = model(fake.source)

    await panel.setActiveNote({ file: 'note.md', content: '{John 15:1}' })

    expect(panel.view.status).toBe('ok')
    expect(panel.view.entries[0].status).toBe('unavailable')
    expect(panel.view.entries[0].verses).toEqual([])
  })

  it('clears back to no-note', async () => {
    const panel = model(fakeSource().source)
    await panel.setActiveNote({ file: 'note.md', content: '{John 15:1}' })

    await panel.setActiveNote(null)

    expect(panel.view).toEqual({ file: null, status: 'no-note', entries: [] })
  })

  it('notifies subscribers as entries resolve', async () => {
    const panel = model(fakeSource().source)
    let notified = 0
    panel.subscribe(() => {
      notified += 1
    })

    await panel.setActiveNote({ file: 'note.md', content: '{John 15:1}' })

    expect(notified).toBeGreaterThan(0)
  })

  it('ignores passage results that land after the note changed', async () => {
    const fake = fakeSource()
    let releaseFirst: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const source: PassageSource = {
      passage: async (reference, translationId) => {
        const result = fake.source.passage(reference, translationId)
        if (fake.requests.length === 1) await gate
        return result
      },
    }
    const panel = model(source)

    const first = panel.setActiveNote({ file: 'a.md', content: '{John 15:1}' })
    const second = panel.setActiveNote({ file: 'b.md', content: '{Genesis 1:1}' })
    releaseFirst()
    await Promise.all([first, second])

    expect(panel.view.file).toBe('b.md')
    expect(panel.view.entries.map((entry) => entry.label)).toEqual([
      'Genesis 1:1',
    ])
  })

  it('reloads entries when the translation changes', async () => {
    const fake = fakeSource()
    const panel = model(fake.source)
    await panel.setActiveNote({ file: 'note.md', content: '{John 15:1}' })

    await panel.setTranslation('bsb')

    expect(fake.requests.map((request) => request.translationId)).toEqual([
      'web',
      'bsb',
    ])
    expect(panel.view.status).toBe('ok')
  })

  it('recovers from no-translation when a translation arrives', async () => {
    const fake = fakeSource()
    const panel = model(fake.source, null)
    await panel.setActiveNote({ file: 'note.md', content: '{John 15:1}' })

    await panel.setTranslation('web')

    expect(panel.view.status).toBe('ok')
    expect(panel.view.entries[0].status).toBe('ok')
  })
})
