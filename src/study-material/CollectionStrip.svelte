<!--
The strip that builds a cross-reference: the members gathered so far, the ways
to add more, and the description they are saved with. Shown while the reader
tab is collecting, whether the collecting started here or in another surface
onto the same tab.
-->
<script lang="ts">
  import type { CollectionView, StudyMaterialSource } from '../contracts'

  let {
    collection,
    source,
  }: {
    collection: CollectionView
    source: StudyMaterialSource
  } = $props()

  const save = (): void => {
    void source.saveCrossReference()
  }
</script>

<div class="bsm-basket">
  <span class="bsm-group-label">Cross-reference</span>
  {#each collection.members as member, index (index)}
    <span class="bsm-chip">
      {member.label}
      <button
        type="button"
        class="bsm-chip-remove"
        aria-label="Remove {member.label}"
        onclick={() => source.removeCollectionMember(index)}
      >✕</button>
    </span>
  {/each}
  <button
    type="button"
    class="bsm-basket-action"
    disabled={!collection.canAddSelection}
    onclick={() => source.addSelectionToCollection()}
  >Add selection</button>
  <input
    class="bsm-basket-input"
    type="text"
    placeholder="Type a reference"
    value={collection.typedMember}
    oninput={(event) => source.typeMember(event.currentTarget.value)}
    onkeydown={(event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        source.addTypedReferenceToCollection()
      }
    }}
  />
  <button
    type="button"
    class="bsm-basket-action"
    onclick={() => source.addTypedReferenceToCollection()}
  >Add</button>
  <input
    class="bsm-basket-input bsm-basket-description"
    type="text"
    placeholder="Why do these belong together? (optional)"
    value={collection.description}
    oninput={(event) => source.describeCollection(event.currentTarget.value)}
    onkeydown={(event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        save()
      }
    }}
  />
  <button
    type="button"
    class="bsm-basket-action mod-cta"
    disabled={!collection.canSave}
    onclick={save}
  >{collection.editing ? 'Save' : 'Create'}</button>
  <button
    type="button"
    class="bsm-basket-action"
    onclick={() => source.cancelCollecting()}
  >Cancel</button>
  {#if collection.editing}
    {#if collection.confirmingDelete}
      <span class="bsm-basket-confirm">Delete this cross-reference?</span>
      <button
        type="button"
        class="bsm-basket-action"
        onclick={() => void source.deleteCrossReference()}
      >Delete</button>
      <button
        type="button"
        class="bsm-basket-action"
        onclick={() => source.cancelDeleteCrossReference()}
      >Keep</button>
    {:else}
      <button
        type="button"
        class="bsm-basket-action bsm-basket-delete"
        onclick={() => source.confirmDeleteCrossReference()}
      >Delete</button>
    {/if}
  {/if}
  {#if collection.error !== null}
    <div class="bsm-basket-error">{collection.error}</div>
  {/if}
</div>

<style>
  .bsm-basket {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px 12px;
    background: hsla(var(--interactive-accent-hsl), 0.08);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .bsm-group-label {
    display: block;
    font-size: var(--font-smallest);
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .bsm-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 999px;
    padding: 1px 4px 1px 10px;
    font-size: var(--font-ui-smaller);
    color: var(--text-normal);
  }

  .bsm-chip-remove {
    background: none;
    border: none;
    box-shadow: none;
    padding: 0 4px;
    font-size: var(--font-smallest);
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsm-chip-remove:hover {
    color: var(--text-error);
    background: none;
  }

  .bsm-basket-action {
    padding: 2px 10px;
    border-radius: var(--radius-s);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
  }

  .bsm-basket-action:disabled {
    color: var(--text-faint);
    cursor: default;
  }

  .bsm-basket-input {
    width: 160px;
    font-size: var(--font-ui-smaller);
  }

  .bsm-basket-description {
    flex: 1;
    min-width: 160px;
  }

  .bsm-basket-confirm {
    font-size: var(--font-ui-smaller);
    color: var(--text-error);
  }

  .bsm-basket-delete:hover {
    color: var(--text-error);
  }

  .bsm-basket-error {
    flex-basis: 100%;
    color: var(--text-error);
    font-size: var(--font-smallest);
  }
</style>
