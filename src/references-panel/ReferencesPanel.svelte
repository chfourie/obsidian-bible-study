<!--
Side-panel listing every scripture referenced by the active note, with the
passage text inline. Clicking a reference heading opens it in the reader.
-->
<script lang="ts">
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
    openReference: (reference: Reference) => void
  } = $props()

  // Initial snapshot only — the model subscription below keeps it fresh.
  // svelte-ignore state_referenced_locally
  let view = $state.raw(model.view)
  $effect(() =>
    model.subscribe(() => {
      view = model.view
    }),
  )

  function open(entry: ReferenceEntryView) {
    openReference(entry.reference)
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
    <div class="bsp-entries">
      {#each view.entries as entry (entry.key)}
        <section class="bsp-entry">
          <span
            role="link"
            tabindex="0"
            class="bsp-entry-title"
            onclick={() => open(entry)}
            onkeydown={activate(() => open(entry))}
          >
            {entry.label}
          </span>
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

  .bsp-entry {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .bsp-entry-title {
    align-self: flex-start;
    font-weight: 600;
    color: var(--text-accent);
    cursor: pointer;
  }

  .bsp-entry-title:hover {
    text-decoration: underline;
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
