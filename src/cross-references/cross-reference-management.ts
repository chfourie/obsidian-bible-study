import type { Reference } from '../reference'
import type { CrossReference, MemberRemoval } from './cross-reference-store'
import { otherMembersView, type CrossReferenceView } from './cross-reference-view'

// The commands in-place management issues; a subset of CrossReferenceCatalog.
export type CrossReferenceCommands = {
  updateDescription: (id: string, description: string | null) => Promise<void>
  removeMember: (id: string, memberIndex: number) => Promise<MemberRemoval>
  delete: (id: string) => Promise<void>
}

export type CrossReferenceManagementDeps = {
  commands: CrossReferenceCommands
  // A command reached the store: the surfacing model re-reads it.
  onChanged: () => void | Promise<void>
  // Only the transient state below moved: the surfacing model re-layers it
  // onto the views already on screen, without a reload.
  onStateChanged: () => void
}

// Managing a cross-reference where it is surfaced — editing its description,
// dropping a member, deleting it — carries transient per-entry state that
// belongs to the pane rather than the store: the reason a removal was refused,
// and whether a delete is awaiting confirmation. Both the reader and the
// references panel manage cross-references this way, so both hold one of these
// and layer its state onto their otherwise-pure views.
export class CrossReferenceManagement {
  #errors: Record<string, string> = {}
  #confirmingDelete = new Set<string>()

  constructor(private readonly deps: CrossReferenceManagementDeps) {}

  view(entry: CrossReference, viewed: Reference[]): CrossReferenceView {
    return {
      ...otherMembersView(entry, viewed),
      error: this.#errors[entry.id] ?? null,
      confirmingDelete: this.#confirmingDelete.has(entry.id),
    }
  }

  async updateDescription(
    id: string,
    description: string | null,
  ): Promise<void> {
    const trimmed = description?.trim() ?? ''
    await this.deps.commands.updateDescription(
      id,
      trimmed === '' ? null : trimmed,
    )
    await this.deps.onChanged()
  }

  async removeMember(id: string, memberIndex: number): Promise<void> {
    const result = await this.deps.commands.removeMember(id, memberIndex)
    if (result.ok) {
      const { [id]: _removed, ...rest } = this.#errors
      this.#errors = rest
    } else {
      this.#errors = { ...this.#errors, [id]: result.reason }
    }
    await this.deps.onChanged()
  }

  confirmDelete(id: string): void {
    this.#confirmingDelete = new Set(this.#confirmingDelete).add(id)
    this.deps.onStateChanged()
  }

  cancelDelete(id: string): void {
    const next = new Set(this.#confirmingDelete)
    next.delete(id)
    this.#confirmingDelete = next
    this.deps.onStateChanged()
  }

  async delete(id: string): Promise<void> {
    await this.deps.commands.delete(id)
    this.cancelDelete(id)
    await this.deps.onChanged()
  }
}
