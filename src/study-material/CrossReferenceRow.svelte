<!--
One cross-reference as both the reader's list and the Study Panel show it
(spec §5a): its summary, every member as a link, and — revealed on hover —
the edit and note icons. The note icon paints filled when the note has a
body, outlined otherwise.
-->
<script lang="ts">
  import type { NavigationOptions } from '../contracts'
  import type { CrossReferenceView } from '../cross-references'
  import type { Reference } from '../reference'
  import { icon, opensInNewPane } from '../ui'

  let {
    entry,
    divided,
    editable = true,
    edit,
    openNote,
    openReference,
  }: {
    entry: CrossReferenceView
    // Draws the item-level divider above the row, deliberately subordinate
    // to the section labels that alone delimit the sections.
    divided: boolean
    // The edit icon stands down while another surface owns the editing seat.
    editable?: boolean
    edit: (entry: CrossReferenceView, event: MouseEvent) => void
    openNote: (path: string, options: NavigationOptions) => void
    openReference: (reference: Reference, options: NavigationOptions) => void
  } = $props()

  const noteTooltip = $derived(
    entry.hasBody ? 'Open note (has notes)' : 'Open note',
  )
</script>

{#if divided}<hr class="bsm-xref-sep" />{/if}
<div class="bsm-xref-block">
  <div class="bsm-xref-actions">
    <button
      type="button"
      class="bsm-xref-action"
      aria-label="Edit cross-reference in the reader"
      disabled={!editable}
      onclick={(event) => edit(entry, event)}
    >✎</button>
    <button
      type="button"
      class="bsm-xref-action bsm-xref-note"
      class:bsm-xref-note-filled={entry.hasBody}
      aria-label={noteTooltip}
      title={noteTooltip}
      use:icon={'file-text'}
      onclick={(event) => openNote(entry.path, { newPane: opensInNewPane(event) })}
    ></button>
  </div>
  {#if entry.summary !== null}
    <div class="bsm-xref-summary">{entry.summary}</div>
  {/if}
  <div class="bsm-xref-members">
    {#each entry.members as member, position (position)}
      <button
        type="button"
        class="bsm-xref-member"
        onclick={(event) =>
          openReference(member.reference, { newPane: opensInNewPane(event) })}
      >{member.label}</button>
    {/each}
  </div>
</div>

<style>
  .bsm-xref-sep {
    width: 2.5rem;
    margin: 8px 0;
    border: none;
    border-top: 1px solid var(--background-modifier-border);
  }

  /* The whole block is one hover target: anywhere over the summary or its
     members reveals the two icons anchored to the block. */
  .bsm-xref-block {
    position: relative;
    margin: 2px -4px;
    padding: 2px 44px 2px 4px;
    border-radius: 4px;
    font-size: var(--font-ui-small);
  }

  .bsm-xref-block:hover {
    background: var(--background-modifier-hover);
  }

  .bsm-xref-summary {
    color: var(--text-muted);
  }

  .bsm-xref-actions {
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    align-items: flex-start;
    gap: 6px;
    opacity: 0;
  }

  .bsm-xref-block:hover .bsm-xref-actions,
  .bsm-xref-actions:focus-within {
    opacity: 1;
  }

  .bsm-xref-action {
    display: flex;
    align-items: flex-start;
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

  .bsm-xref-action:hover:not(:disabled) {
    color: var(--text-accent);
  }

  .bsm-xref-action:disabled {
    color: var(--text-faint);
    cursor: default;
  }

  .bsm-xref-note :global(svg) {
    width: var(--icon-s);
    height: var(--icon-s);
  }

  /* A note with something written in it shows a filled page; an empty one
     stays an outline (spec §5a). */
  .bsm-xref-note-filled :global(svg) {
    fill: currentColor;
    fill-opacity: 0.35;
  }

  .bsm-xref-members {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    margin-top: 2px;
  }

  .bsm-xref-member {
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

  .bsm-xref-member:hover {
    text-decoration: underline;
    background: none;
    box-shadow: none;
  }
</style>
