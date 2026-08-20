import { describe, expect, it } from 'vitest'
import type { StudyMaterial, StudyMaterialSource } from '../contracts'
import type { CrossReference } from '../cross-references'
import {
  enumerateVerseIds,
  makeVerseId,
  referencesIntersect,
  type Reference,
} from '../reference'
import type { Passage, PassageSource } from '../rendering'
import { extractOccurrences } from '../vault-index'
import {
  StudyPanelModel,
  type StudyPanelCrossReferences,
  type StudyPanelDeps,
} from './study-panel-model'
import { freshTabState } from './tab-memory'

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

const noCrossReferences: StudyPanelCrossReferences = {
  intersecting: () => [],
}

const fakeCrossReferenceStore = () => {
  let entries: CrossReference[] = []
  const deps: StudyPanelCrossReferences = {
    intersecting: (reference) =>
      entries.filter((entry) =>
        entry.members.some((member) => referencesIntersect(member, reference)),
      ),
  }
  return {
    deps,
    setEntries: (next: CrossReference[]) => {
      entries = next
    },
  }
}

// A reader tab seen through the study-material contract: the panel never
// touches anything else about it.
const fakeStudyMaterial = () => {
  const listeners = new Set<() => void>()
  let material: StudyMaterial = {
    title: 'John 15',
    selectedVerseId: null,
    selectionEndId: null,
    details: null,
    chapterCrossReferences: [],
    collection: null,
  }
  const source = {
    get studyMaterial(): StudyMaterial {
      return material
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  } as unknown as StudyMaterialSource
  return {
    source,
    subscriptions: () => listeners.size,
    select: (verseId: number) => {
      material = { ...material, selectedVerseId: verseId }
      listeners.forEach((listener) => listener())
    },
  }
}

const model = (
  source: PassageSource,
  translationId: string | null = 'web',
  crossReferences: StudyPanelCrossReferences = noCrossReferences,
  editCrossReference: StudyPanelDeps['editCrossReference'] = () => {},
): StudyPanelModel =>
  new StudyPanelModel(
    {
      passages: source,
      extract: (content) =>
        extractOccurrences(content, { translationIds: ['web', 'niv', 'kjv'] }),
      crossReferences,
      editCrossReference,
    },
    { translationId },
  )

describe('StudyPanelModel', () => {
  it('starts with no note', () => {
    const panel = model(fakeSource().source)

    expect(panel.view).toEqual({
      file: null,
      title: null,
      status: 'no-note',
      entries: [],
      crossReferences: [],
      studyMaterial: null,
      subTab: 'translations',
      folded: new Set(),
    })
  })

  it('titles the view with the note name, without folder or extension', async () => {
    const panel = model(fakeSource().source)

    await panel.setActiveNote({
      file: 'Sermons/Vine.md',
      content: 'On {John 15:1}.',
    })

    expect(panel.view.title).toBe('Vine')
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

  it('keeps intersecting references from different translations separate', async () => {
    const fake = fakeSource()
    const panel = model(fake.source)

    await panel.setActiveNote({
      file: 'note.md',
      content: '{Psalms 25:1-5} then {Psalms 25:4 niv}',
    })

    expect(
      panel.view.entries.map((entry) => [entry.label, entry.translationLabel]),
    ).toEqual([
      ['Psalms 25:1-5', 'WEB'],
      ['Psalms 25:4', 'NIV'],
    ])
    expect(fake.requests.map((request) => request.translationId)).toEqual([
      'web',
      'niv',
    ])
  })

  it('combines intersecting references naming the same translation', async () => {
    const panel = model(fakeSource().source)

    await panel.setActiveNote({
      file: 'note.md',
      content: '{Psalms 25:1-3 niv} and {Psalms 25:2-5 niv}',
    })

    expect(
      panel.view.entries.map((entry) => [entry.label, entry.translationLabel]),
    ).toEqual([['Psalms 25:1-5', 'NIV']])
  })

  it('loads explicit-translation entries even without a default translation', async () => {
    const panel = model(fakeSource().source, null)

    await panel.setActiveNote({
      file: 'note.md',
      content: '{John 15:1} and {Psalms 25:4 niv}',
    })

    expect(panel.view.status).toBe('ok')
    expect(
      panel.view.entries.map((entry) => [entry.status, entry.translationLabel]),
    ).toEqual([
      ['unavailable', null],
      ['ok', 'NIV'],
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

    expect(panel.view).toEqual({
      file: null,
      title: null,
      status: 'no-note',
      entries: [],
      crossReferences: [],
      studyMaterial: null,
      subTab: 'translations',
      folded: new Set(),
    })
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

describe('cross-references in the Study Panel', () => {
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

  it('lists an intersecting cross-reference with every member and its description', async () => {
    const store = fakeCrossReferenceStore()
    store.setEntries([vineCrossReference])
    const panel = model(fakeSource().source, 'web', store.deps)

    await panel.setActiveNote({ file: 'note.md', content: '{John 15:4}' })

    expect(panel.view.crossReferences).toEqual([
      {
        id: 'xr-vine',
        description: 'Vine and vineyard imagery for Israel',
        members: [
          { label: 'John 15:1-8', reference: john15Vine, index: 0 },
          { label: 'Psalms 80:8-16', reference: psalm80Vine, index: 1 },
          { label: 'Romans 11:17-24', reference: romans11Olive, index: 2 },
        ],
        allMembers: vineCrossReference.members,
      },
    ])
  })

  it('leaves non-intersecting cross-references out of the panel', async () => {
    const elsewhere: CrossReference = {
      id: 'xr-elsewhere',
      members: [reference(43, [[15, 9], [15, 9]]), reference(19, [[23, 1], [23, 1]])],
      description: null,
    }
    const store = fakeCrossReferenceStore()
    store.setEntries([vineCrossReference, elsewhere])
    const panel = model(fakeSource().source, 'web', store.deps)

    await panel.setActiveNote({ file: 'note.md', content: '{John 15:4}' })

    expect(panel.view.crossReferences.map((entry) => entry.id)).toEqual([
      'xr-vine',
    ])
  })

  it('lists a cross-reference at most once even when it intersects several entries', async () => {
    const store = fakeCrossReferenceStore()
    store.setEntries([vineCrossReference])
    const panel = model(fakeSource().source, 'web', store.deps)

    await panel.setActiveNote({
      file: 'note.md',
      content: '{John 15:4} and {Psalms 80:10}',
    })

    expect(panel.view.crossReferences.map((entry) => entry.id)).toEqual([
      'xr-vine',
    ])
    expect(
      panel.view.crossReferences[0].members.map((member) => member.label),
    ).toEqual(['Psalms 80:8-16', 'John 15:1-8', 'Romans 11:17-24'])
  })

  it('orders members by book and start verse', async () => {
    const store = fakeCrossReferenceStore()
    store.setEntries([
      {
        id: 'xr-order',
        members: [
          john15Vine,
          romans11Olive,
          reference(43, [[8, 31], [8, 32]]),
          psalm80Vine,
        ],
        description: null,
      },
    ])
    const panel = model(fakeSource().source, 'web', store.deps)

    await panel.setActiveNote({ file: 'note.md', content: '{Romans 11:20}' })

    expect(
      panel.view.crossReferences[0].members.map((member) => member.label),
    ).toEqual([
      'Romans 11:17-24',
      'Psalms 80:8-16',
      'John 8:31-32',
      'John 15:1-8',
    ])
  })

  it('leads a cross-reference with members sharing a chapter with the note', async () => {
    const store = fakeCrossReferenceStore()
    store.setEntries([
      {
        id: 'xr-order',
        members: [
          psalm80Vine,
          reference(43, [[15, 22], [15, 25]]),
          reference(43, [[8, 31], [8, 32]]),
        ],
        description: null,
      },
    ])
    const panel = model(fakeSource().source, 'web', store.deps)

    await panel.setActiveNote({ file: 'note.md', content: '{Psalms 80:10}' })

    expect(
      panel.view.crossReferences[0].members.map((member) => member.label),
    ).toEqual(['Psalms 80:8-16', 'John 8:31-32', 'John 15:22-25'])
  })

  it('keeps a cross-reference whose members are all in the note', async () => {
    const store = fakeCrossReferenceStore()
    store.setEntries([
      {
        id: 'xr-self',
        members: [john15Vine, reference(43, [[15, 2], [15, 3]])],
        description: 'The vine',
      },
    ])
    const panel = model(fakeSource().source, 'web', store.deps)

    await panel.setActiveNote({ file: 'note.md', content: '{John 15:1-8}' })

    expect(panel.view.crossReferences.map((entry) => entry.id)).toEqual([
      'xr-self',
    ])
  })

  it('orders cross-references by their leading member', async () => {
    const store = fakeCrossReferenceStore()
    store.setEntries([
      {
        id: 'xr-john',
        members: [romans11Olive, reference(43, [[15, 22], [15, 25]])],
        description: null,
      },
      {
        id: 'xr-deuteronomy',
        members: [romans11Olive, reference(5, [[9, 2], [9, 5]])],
        description: null,
      },
      {
        id: 'xr-same-chapter',
        members: [romans11Olive, reference(45, [[11, 1], [11, 4]])],
        description: null,
      },
    ])
    const panel = model(fakeSource().source, 'web', store.deps)

    await panel.setActiveNote({ file: 'note.md', content: '{Romans 11:20}' })

    expect(panel.view.crossReferences.map((entry) => entry.id)).toEqual([
      'xr-same-chapter',
      'xr-deuteronomy',
      'xr-john',
    ])
  })

  it('updates live when the cross-reference store changes', async () => {
    const store = fakeCrossReferenceStore()
    const panel = model(fakeSource().source, 'web', store.deps)
    await panel.setActiveNote({ file: 'note.md', content: '{John 15:4}' })
    expect(panel.view.crossReferences).toEqual([])

    store.setEntries([vineCrossReference])
    panel.refreshCrossReferences()

    expect(panel.view.crossReferences.map((entry) => entry.id)).toEqual([
      'xr-vine',
    ])
  })

  it('notifies subscribers when cross-references refresh', async () => {
    const store = fakeCrossReferenceStore()
    const panel = model(fakeSource().source, 'web', store.deps)
    await panel.setActiveNote({ file: 'note.md', content: '{John 15:4}' })
    let notified = 0
    panel.subscribe(() => {
      notified += 1
    })

    store.setEntries([vineCrossReference])
    panel.refreshCrossReferences()

    expect(notified).toBe(1)
  })

  describe('editing a cross-reference from the panel', () => {
    it('hands the full member list and description to the reader to edit', async () => {
      const store = fakeCrossReferenceStore()
      store.setEntries([vineCrossReference])
      const edited: CrossReference[] = []
      const panel = model(
        fakeSource().source,
        'web',
        store.deps,
        (entry) => {
          edited.push(entry)
        },
      )
      await panel.setActiveNote({ file: 'note.md', content: '{John 15:4}' })

      panel.editCrossReference('xr-vine')

      expect(edited).toEqual([
        {
          id: 'xr-vine',
          members: vineCrossReference.members,
          description: vineCrossReference.description,
        },
      ])
    })

    it('passes the new-pane request on to the editor', async () => {
      const store = fakeCrossReferenceStore()
      store.setEntries([vineCrossReference])
      const requested: (boolean | undefined)[] = []
      const panel = model(
        fakeSource().source,
        'web',
        store.deps,
        (_entry, options) => {
          requested.push(options?.newPane)
        },
      )
      await panel.setActiveNote({ file: 'note.md', content: '{John 15:4}' })

      panel.editCrossReference('xr-vine')
      panel.editCrossReference('xr-vine', { newPane: true })

      expect(requested).toEqual([undefined, true])
    })

    it('ignores editing an id that is not currently surfaced', async () => {
      const store = fakeCrossReferenceStore()
      let edited = 0
      const panel = model(fakeSource().source, 'web', store.deps, () => {
        edited++
      })
      await panel.setActiveNote({ file: 'note.md', content: '{John 15:4}' })

      panel.editCrossReference('xr-unknown')

      expect(edited).toBe(0)
    })
  })

  describe('mirroring a focused reader tab', () => {
    it('starts with no study material', () => {
      const panel = model(fakeSource().source)

      expect(panel.view.studyMaterial).toBe(null)
      expect(panel.studySource).toBe(null)
    })

    it('shows the study material of the focused reader tab', () => {
      const panel = model(fakeSource().source)
      const reader = fakeStudyMaterial()

      panel.showStudyMaterial(reader.source)

      expect(panel.view.studyMaterial).toEqual(reader.source.studyMaterial)
      expect(panel.studySource).toBe(reader.source)
    })

    it('titles the view with the followed reader’s title over the note’s', async () => {
      const panel = model(fakeSource().source)
      await panel.setActiveNote({ file: 'Sermons/Vine.md', content: 'x' })
      const reader = fakeStudyMaterial()

      panel.showStudyMaterial(reader.source)

      expect(panel.view.title).toBe('John 15')

      panel.showStudyMaterial(null)
      expect(panel.view.title).toBe('Vine')
    })

    it('notifies subscribers when the shown tab changes', () => {
      const panel = model(fakeSource().source)
      const reader = fakeStudyMaterial()
      let notified = 0
      panel.subscribe(() => {
        notified += 1
      })

      panel.showStudyMaterial(reader.source)

      expect(notified).toBe(1)
    })

    it('follows the tab as its selection changes', () => {
      const panel = model(fakeSource().source)
      const reader = fakeStudyMaterial()
      panel.showStudyMaterial(reader.source)
      let notified = 0
      panel.subscribe(() => {
        notified += 1
      })

      reader.select(makeVerseId(43, 15, 1))

      expect(notified).toBe(1)
      expect(panel.view.studyMaterial?.selectedVerseId).toBe(
        makeVerseId(43, 15, 1),
      )
    })

    it('keeps the focused note behind the reader view', async () => {
      const panel = model(fakeSource().source)
      await panel.setActiveNote({ file: 'note.md', content: '{John 15:1}' })
      const reader = fakeStudyMaterial()

      panel.showStudyMaterial(reader.source)

      expect(panel.view.file).toBe('note.md')
      expect(panel.view.entries.map((entry) => entry.label)).toEqual([
        'John 15:1',
      ])
    })

    it('returns to the note view when no reader is focused', async () => {
      const panel = model(fakeSource().source)
      await panel.setActiveNote({ file: 'note.md', content: '{John 15:1}' })
      const reader = fakeStudyMaterial()
      panel.showStudyMaterial(reader.source)

      panel.showStudyMaterial(null)

      expect(panel.view.studyMaterial).toBe(null)
      expect(panel.view.status).toBe('ok')
    })

    it('stops following a tab it no longer shows', () => {
      const panel = model(fakeSource().source)
      const reader = fakeStudyMaterial()
      panel.showStudyMaterial(reader.source)

      panel.showStudyMaterial(null)

      expect(reader.subscriptions()).toBe(0)
    })

    it('follows only the tab shown last', () => {
      const panel = model(fakeSource().source)
      const first = fakeStudyMaterial()
      const second = fakeStudyMaterial()
      panel.showStudyMaterial(first.source)

      panel.showStudyMaterial(second.source)

      expect(first.subscriptions()).toBe(0)
      expect(second.subscriptions()).toBe(1)
      expect(panel.studySource).toBe(second.source)
    })

    it('ignores being shown the tab it already follows', () => {
      const panel = model(fakeSource().source)
      const reader = fakeStudyMaterial()
      panel.showStudyMaterial(reader.source)

      panel.showStudyMaterial(reader.source)

      expect(reader.subscriptions()).toBe(1)
    })
  })

  describe('followed tab state', () => {
    it('writes the sub-tab choice into the followed tab’s state', () => {
      const panel = model(fakeSource().source)
      const state = freshTabState()
      panel.useTabState(state)

      panel.selectSubTab('notes')

      expect(panel.view.subTab).toBe('notes')
      expect(state.subTab).toBe('notes')
    })

    it('folds every entry until the followed tab unfolds one', async () => {
      const panel = model(fakeSource().source)
      const state = freshTabState()
      panel.useTabState(state)
      await panel.setActiveNote({
        file: 'note.md',
        content: 'On {John 15:1} and {Genesis 1:1}.',
      })

      expect([...panel.view.folded]).toEqual(['|John 15:1', '|Genesis 1:1'])

      panel.toggleFold('|John 15:1')

      expect([...panel.view.folded]).toEqual(['|Genesis 1:1'])
      expect([...state.expanded]).toEqual(['|John 15:1'])
    })

    it('unfolds every entry at once, and folds them all again', async () => {
      const panel = model(fakeSource().source)
      await panel.setActiveNote({
        file: 'Sermons/Vine.md',
        content: 'On {John 15:1} and {Genesis 1:1}.',
      })
      const keys = panel.view.entries.map((entry) => entry.key)

      panel.expandAll()
      expect([...panel.view.folded]).toEqual([])

      panel.foldAll()
      expect([...panel.view.folded].sort()).toEqual([...keys].sort())
    })

    it('writes an unfold of every entry into the followed tab’s state', async () => {
      const panel = model(fakeSource().source)
      const state = freshTabState()
      panel.useTabState(state)
      await panel.setActiveNote({
        file: 'Sermons/Vine.md',
        content: 'On {John 15:1}.',
      })

      panel.expandAll()

      expect([...state.expanded]).toEqual(
        panel.view.entries.map((entry) => entry.key),
      )
    })

    it('folds an entry it unfolded before', async () => {
      const panel = model(fakeSource().source)
      await panel.setActiveNote({ file: 'note.md', content: '{John 15:1}' })
      panel.toggleFold('|John 15:1')

      panel.toggleFold('|John 15:1')

      expect([...panel.view.folded]).toEqual(['|John 15:1'])
    })

    it('shows the state of the tab it is handed', async () => {
      const panel = model(fakeSource().source)
      const first = freshTabState()
      const second = freshTabState()
      panel.useTabState(first)
      await panel.setActiveNote({ file: 'note.md', content: '{John 15:1}' })
      panel.selectSubTab('notes')
      panel.toggleFold('|John 15:1')

      panel.useTabState(second)

      expect(panel.view.subTab).toBe('translations')
      expect([...panel.view.folded]).toEqual(['|John 15:1'])

      panel.useTabState(first)
      expect(panel.view.subTab).toBe('notes')
      expect([...panel.view.folded]).toEqual([])
    })

    it('falls back to a fresh state when it follows no tab', () => {
      const panel = model(fakeSource().source)
      const state = freshTabState()
      panel.useTabState(state)
      panel.selectSubTab('notes')

      panel.useTabState(null)
      panel.selectSubTab('notes')

      expect(state.subTab).toBe('notes')
      expect(panel.view.subTab).toBe('notes')
    })

    it('tells its listeners when the followed state changes', () => {
      const panel = model(fakeSource().source)
      let notifications = 0
      panel.subscribe(() => {
        notifications += 1
      })

      panel.useTabState(freshTabState())
      panel.selectSubTab('notes')
      panel.toggleFold('|John 15:1')

      expect(notifications).toBe(3)
    })
  })
})
