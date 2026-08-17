<!--
Side-panel listing every scripture referenced by the active note, with the
passage text inline. Headings fold their passage; the book icon opens the
reference in the reader with the entry's translation.
-->
<script lang="ts">
  import { setIcon } from 'obsidian'
  import type { Reference } from '../reference'
  import { activate } from '../ui'
  import type {
    ReferenceEntryView,
    ReferencesPanelModel,
  } from './references-panel-model'

  let {
    model,
    openReference,
  }: {
    model: ReferencesPanelModel
    openReference: (reference: Reference, translationId: string | null) => void
  } = $props()

  // Initial snapshot only — the model subscription below keeps it fresh.
  // svelte-ignore state_referenced_locally
  let view = $state.raw(model.view)
  $effect(() =>
    model.subscribe(() => {
      view = model.view
    }),
  )

  let folded = $state(new Set<string>())

  function icon(node: HTMLElement, name: string) {
    setIcon(node, name)
    return {
      update(next: string) {
        node.empty()
        setIcon(node, next)
      },
    }
  }

  function toggleFold(entry: ReferenceEntryView) {
    const next = new Set(folded)
    if (!next.delete(entry.key)) next.add(entry.key)
    folded = next
  }

  function open(entry: ReferenceEntryView) {
    openReference(entry.reference, entry.translation)
  }

  let editingXrefDescription: string | null = $state(null)
  let xrefDescriptionDraft = $state('')

  const startEditingXrefDescription = (
    entry: { id: string; description: string | null },
  ): void => {
    editingXrefDescription = entry.id
    xrefDescriptionDraft = entry.description ?? ''
  }

  const commitXrefDescription = (id: string): void => {
    void model.updateCrossReferenceDescription(id, xrefDescriptionDraft)
    editingXrefDescription = null
  }

  const cancelEditingXrefDescription = (): void => {
    editingXrefDescription = null
  }

  const removeXrefMember = (id: string, memberIndex: number): void => {
    void model.removeCrossReferenceMember(id, memberIndex)
  }

  const growCrossReference = (id: string): void => {
    model.growCrossReference(id)
  }
</script>

<div class="bsp-panel">
  {#if view.status === 'no-note'}
    <p class="bsp-empty">Open a note to see its scripture references.</p>
  {:else if view.status === 'no-references'}
    <p class="bsp-empty">No scripture references in this note.</p>
  {:else}
    {#if view.status === 'no-translation'}
      <p class="bsp-empty">No translation installed.</p>
    {/if}
    {#if view.crossReferences.length > 0}
      <div class="bsp-xrefs">
        <div class="bsp-group-label">Cross-references</div>
        {#each view.crossReferences as entry (entry.id)}
          <div class="bsp-xref-block">
            {#if editingXrefDescription === entry.id}
              <input
                class="bsp-xref-description-input"
                type="text"
                placeholder="Why do these belong together? (optional)"
                bind:value={xrefDescriptionDraft}
                onkeydown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitXrefDescription(entry.id)
                  } else if (event.key === 'Escape') {
                    cancelEditingXrefDescription()
                  }
                }}
                onblur={() => commitXrefDescription(entry.id)}
              />
            {:else}
              <button
                type="button"
                class="bsp-xref-description"
                onclick={() => startEditingXrefDescription(entry)}
              >{entry.description ?? 'Add a description…'}</button>
            {/if}
            <div class="bsp-xref-members">
              {#each entry.members as member (member.index)}
                <span class="bsp-xref-member-chip">
                  <button
                    type="button"
                    class="bsp-xref-member"
                    onclick={() => openReference(member.reference, null)}
                  >{member.label}</button>
                  <button
                    type="button"
                    class="bsp-xref-member-remove"
                    aria-label="Remove {member.label} from this cross-reference"
                    onclick={() => removeXrefMember(entry.id, member.index)}
                  >✕</button>
                </span>
              {/each}
            </div>
            {#if entry.error !== null}
              <div class="bsp-xref-error">{entry.error}</div>
            {/if}
            {#if entry.confirmingDelete}
              <div class="bsp-xref-confirm-delete">
                <span>Delete this cross-reference?</span>
                <button
                  type="button"
                  class="bsp-xref-confirm-action"
                  onclick={() => void model.deleteCrossReference(entry.id)}
                >Delete</button>
                <button
                  type="button"
                  class="bsp-xref-confirm-action"
                  onclick={() => model.cancelDeleteCrossReference(entry.id)}
                >Cancel</button>
              </div>
            {:else}
              <button
                type="button"
                class="bsp-xref-delete"
                onclick={() => growCrossReference(entry.id)}
              >Add members</button>
              <button
                type="button"
                class="bsp-xref-delete"
                onclick={() => model.confirmDeleteCrossReference(entry.id)}
              >Delete cross-reference</button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
    <div class="bsp-entries">
      {#each view.entries as entry (entry.key)}
        <section class="bsp-entry">
          <div class="bsp-entry-head">
            <span
              role="button"
              tabindex="0"
              class="bsp-entry-title"
              aria-expanded={!folded.has(entry.key)}
              onclick={() => toggleFold(entry)}
              onkeydown={activate(() => toggleFold(entry))}
            >
              <span
                class="bsp-fold-icon"
                aria-hidden="true"
                use:icon={folded.has(entry.key)
                  ? 'chevron-right'
                  : 'chevron-down'}
              ></span>
              {entry.label}
              {#if entry.translationLabel !== null}
                <span class="bsp-translation">· {entry.translationLabel}</span>
              {/if}
            </span>
            <span
              role="button"
              tabindex="0"
              class="bsp-open-reader"
              aria-label="Open in reader"
              title="Open in reader"
              use:icon={'book-open-text'}
              onclick={() => open(entry)}
              onkeydown={activate(() => open(entry))}
            ></span>
          </div>
          {#if !folded.has(entry.key)}
            {#if entry.status === 'loading'}
              <p class="bsp-entry-state">Loading…</p>
            {:else if entry.status === 'unavailable'}
              {#if view.status !== 'no-translation'}
                <p class="bsp-entry-state">Unavailable offline</p>
              {/if}
            {:else}
              <div class="bsp-verses">
                {#each entry.verses as verse, index (index)}
                  <p class="bsp-verse">
                    {#if verse.label !== null}
                      <span class="bsp-verse-number">{verse.label}</span>
                    {/if}{verse.text}
                  </p>
                {/each}
              </div>
              {#if entry.attribution !== null}
                <p class="bsp-attribution">{entry.attribution}</p>
              {/if}
            {/if}
          {/if}
        </section>
      {/each}
    </div>
  {/if}
</div>

<style>
  .bsp-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.25rem 0;
  }

  .bsp-empty {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }

  .bsp-entries {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .bsp-xrefs {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .bsp-group-label {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    font-weight: 600;
    text-transform: uppercase;
  }

  .bsp-xref-block {
    font-size: var(--font-ui-small);
  }

  .bsp-xref-description {
    display: block;
    width: 100%;
    padding: 0;
    margin: 0;
    border: none;
    border-radius: 0;
    background: none;
    box-shadow: none;
    height: auto;
    font-size: inherit;
    text-align: left;
    color: var(--text-muted);
    cursor: text;
  }

  .bsp-xref-description:hover {
    color: var(--text-normal);
    background: none;
    box-shadow: none;
  }

  .bsp-xref-description-input {
    width: 100%;
    font-size: inherit;
    margin: 2px 0;
  }

  .bsp-xref-members {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    margin-top: 2px;
  }

  .bsp-xref-member-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .bsp-xref-member {
    display: inline;
    padding: 0;
    margin: 0;
    border: none;
    border-radius: 0;
    background: none;
    box-shadow: none;
    height: auto;
    font-size: inherit;
    text-align: left;
    color: var(--text-accent);
    cursor: pointer;
  }

  .bsp-xref-member:hover {
    text-decoration: underline;
    background: none;
    box-shadow: none;
  }

  .bsp-xref-member-remove {
    padding: 0 2px;
    margin: 0;
    border: none;
    border-radius: 0;
    background: none;
    box-shadow: none;
    height: auto;
    font-size: var(--font-smallest);
    color: var(--text-faint);
    cursor: pointer;
  }

  .bsp-xref-member-remove:hover {
    color: var(--text-error);
    background: none;
    box-shadow: none;
  }

  .bsp-xref-error {
    margin-top: 2px;
    color: var(--text-error);
    font-size: var(--font-ui-smaller);
  }

  .bsp-xref-delete {
    margin-top: 4px;
    padding: 0;
    border: none;
    background: none;
    box-shadow: none;
    height: auto;
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
    cursor: pointer;
  }

  .bsp-xref-delete:hover {
    color: var(--text-error);
    background: none;
    box-shadow: none;
  }

  .bsp-xref-confirm-delete {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    font-size: var(--font-ui-smaller);
    color: var(--text-error);
  }

  .bsp-xref-confirm-action {
    padding: 1px 8px;
    height: auto;
    font-size: var(--font-ui-smaller);
  }

  .bsp-entry {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .bsp-entry-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .bsp-entry-title {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    font-weight: 600;
    color: var(--text-accent);
    cursor: pointer;
  }

  .bsp-fold-icon {
    display: inline-flex;
    align-items: center;
    color: var(--text-muted);
  }

  .bsp-fold-icon :global(svg) {
    width: var(--icon-xs);
    height: var(--icon-xs);
  }

  .bsp-translation {
    font-weight: 400;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  .bsp-open-reader {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    padding: 2px;
    border-radius: var(--radius-s);
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsp-open-reader:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .bsp-open-reader :global(svg) {
    width: var(--icon-s);
    height: var(--icon-s);
  }

  .bsp-entry-state {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }

  .bsp-verses {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .bsp-verse {
    margin: 0;
    line-height: var(--line-height-normal);
  }

  .bsp-verse-number {
    margin-right: 0.35em;
    color: var(--text-faint);
    font-size: 0.75em;
    vertical-align: super;
  }

  .bsp-attribution {
    margin: 0;
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
  }
</style>
