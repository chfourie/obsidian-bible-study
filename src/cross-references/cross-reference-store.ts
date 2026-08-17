import { referencesIntersect, type Reference, type VerseRange } from '../reference'
import type { CrossReferenceVault } from './cross-reference-vault'

export const CROSS_REFERENCES_FILE_PATH = 'scripture-study-cross-references.jsonl'

export type CrossReference = {
  id: string
  members: Reference[]
  description: string | null
}

const serializeRange = (range: VerseRange): Record<string, unknown> => ({
  startId: range.startId,
  endId: range.endId,
})

const serializeMember = (member: Reference): Record<string, unknown> => ({
  book: member.book,
  ranges: member.ranges.map(serializeRange),
})

export const serializeCrossReference = (entry: CrossReference): string =>
  JSON.stringify({
    id: entry.id,
    members: entry.members.map(serializeMember),
    ...(entry.description === null ? {} : { description: entry.description }),
  })

const isVerseRange = (value: unknown): value is VerseRange =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as VerseRange).startId === 'number' &&
  typeof (value as VerseRange).endId === 'number'

const isMember = (value: unknown): value is Reference =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Reference).book === 'number' &&
  Array.isArray((value as Reference).ranges) &&
  (value as Reference).ranges.length > 0 &&
  (value as Reference).ranges.every(isVerseRange)

const parseLine = (line: string): CrossReference | null => {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { id, members, description } = parsed as Record<string, unknown>
  if (typeof id !== 'string') return null
  if (!Array.isArray(members) || !members.every(isMember)) return null
  return {
    id,
    members: members.map((member) => ({
      book: member.book,
      ranges: member.ranges.map(({ startId, endId }) => ({ startId, endId })),
    })),
    description: typeof description === 'string' ? description : null,
  }
}

const generateId = (): string =>
  `xr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

// A cross-reference always connects at least two references; removing a
// member below that floor is blocked rather than allowed to degenerate.
export const CROSS_REFERENCE_MINIMUM_MEMBERS = 2

export type MemberRemoval = { ok: true } | { ok: false; reason: string }

export type CrossReferenceStoreOptions = {
  newId?: () => string
}

export class CrossReferenceStore {
  #entries: CrossReference[] = []
  readonly #listeners = new Set<() => void>()
  readonly #newId: () => string

  constructor(
    private readonly vault: CrossReferenceVault,
    options: CrossReferenceStoreOptions = {},
  ) {
    this.#newId = options.newId ?? generateId
  }

  onChanged(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  #notify(): void {
    this.#listeners.forEach((listener) => listener())
  }

  async load(): Promise<void> {
    const content = await this.vault.read(CROSS_REFERENCES_FILE_PATH)
    this.#entries =
      content === null
        ? []
        : content
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line !== '')
            .map(parseLine)
            .filter((entry) => entry !== null)
    this.#notify()
  }

  all(): CrossReference[] {
    return this.#entries
  }

  intersecting(reference: Reference): CrossReference[] {
    return this.#entries.filter((entry) =>
      entry.members.some((member) => referencesIntersect(member, reference)),
    )
  }

  async create(
    members: Reference[],
    description: string | null,
  ): Promise<CrossReference> {
    const entry: CrossReference = { id: this.#newId(), members, description }
    this.#entries = [...this.#entries, entry]
    await this.save()
    return entry
  }

  async updateDescription(id: string, description: string | null): Promise<void> {
    if (!this.#entries.some((entry) => entry.id === id)) return
    this.#entries = this.#entries.map((entry) =>
      entry.id === id ? { ...entry, description } : entry,
    )
    await this.save()
  }

  async update(
    id: string,
    members: Reference[],
    description: string | null,
  ): Promise<void> {
    if (!this.#entries.some((entry) => entry.id === id)) return
    this.#entries = this.#entries.map((entry) =>
      entry.id === id ? { ...entry, members, description } : entry,
    )
    await this.save()
  }

  async removeMember(id: string, memberIndex: number): Promise<MemberRemoval> {
    const entry = this.#entries.find((candidate) => candidate.id === id)
    if (entry === undefined) return { ok: false, reason: 'Cross-reference not found.' }
    if (entry.members.length <= CROSS_REFERENCE_MINIMUM_MEMBERS) {
      return {
        ok: false,
        reason:
          'A cross-reference needs at least two members — delete it instead.',
      }
    }
    this.#entries = this.#entries.map((candidate) =>
      candidate.id === id
        ? {
            ...candidate,
            members: candidate.members.filter(
              (_member, index) => index !== memberIndex,
            ),
          }
        : candidate,
    )
    await this.save()
    return { ok: true }
  }

  async delete(id: string): Promise<void> {
    if (!this.#entries.some((entry) => entry.id === id)) return
    this.#entries = this.#entries.filter((entry) => entry.id !== id)
    await this.save()
  }

  // Entries keep their file order and each occupies one line, so a save that
  // changed nothing rewrites the file byte for byte.
  async save(): Promise<void> {
    await this.vault.write(
      CROSS_REFERENCES_FILE_PATH,
      this.#entries.map((entry) => `${serializeCrossReference(entry)}\n`).join(''),
    )
    this.#notify()
  }
}
