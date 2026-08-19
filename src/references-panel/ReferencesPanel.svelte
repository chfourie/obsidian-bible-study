<!--
Side-panel listing every scripture referenced by the active note, with the
passage text inline. Headings fold their passage; the book icon opens the
reference in the reader with the entry's translation.
-->
<script lang="ts">
  import { setIcon } from 'obsidian'
  import type { NavigationOptions } from '../contracts'
  import type { Reference } from '../reference'
  import { activate, opensInNewPane } from '../ui'
  import type {
    ReferenceEntryView,
    ReferencesPanelModel,
  } from './references-panel-model'

  let {
    model,
    openReference,
  }: {
    model: ReferencesPanelModel
    openReference: (
      reference: Reference,
      translationId: string | null,
      options?: NavigationOptions,
    ) => void
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

  function open(entry: ReferenceEntryView, event: MouseEvent | KeyboardEvent) {
    openReference(entry.reference, entry.translation, {
      newPane: opensInNewPane(event),
    })
  }

  const editCrossReference = (id: string, event: MouseEvent): void => {
    model.editCrossReference(id, { newPane: opensInNewPane(event) })
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
        {#each view.crossReferences as entry, index (entry.id)}
          {#if index > 0}
            <hr class="bsp-xref-divider" />
          {/if}
          <div class="bsp-xref-block">
            <button
              type="button"
              class="bsp-xref-edit"
              aria-label="Edit cross-reference in the reader"
              onclick={(event) => editCrossReference(entry.id, event)}
            >✎</button>
            {#if entry.description !== null}
              <div class="bsp-xref-description">{entry.description}</div>
            {/if}
            <div class="bsp-xref-members">
              {#each entry.members as member (member.index)}
                <button
                  type="button"
                  class="bsp-xref-member"
                  onclick={(event) =>
                    openReference(member.reference, null, {
                      newPane: opensInNewPane(event),
                    })}
                >{member.label}</button>
              {/each}
            </div>
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
              onclick={(event) => open(entry, event)}
              onkeydown={activate((event) => open(entry, event))}
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

  /* The whole block is one hover target: anywhere over the description or its
     members reveals the single edit icon anchored to the block. */
  .bsp-xref-block {
    position: relative;
    margin: 2px -4px;
    padding: 2px 24px 2px 4px;
    border-radius: 4px;
    font-size: var(--font-ui-small);
  }

  .bsp-xref-block:hover {
    background: var(--background-modifier-hover);
  }

  .bsp-xref-divider {
    width: 66%;
    margin: 0 auto;
    border: 0;
    border-top: 1px solid var(--background-modifier-border);
  }

  .bsp-xref-description {
    color: var(--text-muted);
  }

  .bsp-xref-edit {
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    align-items: flex-start;
    opacity: 0;
    background: none;
    border: none;
    box-shadow: none;
    width: auto;
    height: auto;
    min-height: 0;
    padding: 0;
    line-height: 1;
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsp-xref-block:hover .bsp-xref-edit,
  .bsp-xref-edit:focus-visible {
    opacity: 1;
  }

  .bsp-xref-edit:hover {
    color: var(--text-accent);
  }

  .bsp-xref-members {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    margin-top: 2px;
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
