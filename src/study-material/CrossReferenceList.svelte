<!--
The cross-references touching whatever the section covers — a verse or the
chapter on screen — with the action that starts collecting a new one. Each row
opens its members, loads itself into the collect strip for editing, or opens
the note behind it.
-->
<script lang="ts">
  import type { StudyMaterialSource } from '../contracts'
  import type { CrossReference, CrossReferenceView } from '../cross-references'
  import { icon, opensInNewPane } from '../ui'
  import SectionHeading from './SectionHeading.svelte'
  import type { StudyMaterialHost } from './study-material-host'

  let {
    entries,
    source,
    host,
    collecting,
  }: {
    entries: CrossReferenceView[]
    source: StudyMaterialSource
    host: StudyMaterialHost
    // While a cross-reference is being collected the strip owns the editing
    // seat, so the row actions stand down until it is done.
    collecting: boolean
  } = $props()

  const edit = (entry: CrossReferenceView, event: MouseEvent): void => {
    const edited: CrossReference = {
      id: entry.path,
      members: entry.allMembers,
      description: entry.summary,
    }
    if (opensInNewPane(event)) host.editCrossReferenceInNewPane(edited)
    else source.startEditingCrossReference(edited)
  }

  const noteTooltip = (entry: CrossReferenceView): string =>
    entry.hasBody ? 'Open note (has notes)' : 'Open note'
</script>

<SectionHeading
  label="Cross-references"
  action="Collect a cross-reference"
  onAdd={() => source.startCollecting()}
  disabled={collecting}
/>
{#each entries as entry, index (entry.path)}
  {#if index > 0}<hr class="bsm-xref-sep" />{/if}
  <div class="bsm-xref-block">
    <div class="bsm-xref-actions">
      <button
        type="button"
        class="bsm-xref-action"
        aria-label="Edit cross-reference in the reader"
        disabled={collecting}
        onclick={(event) => edit(entry, event)}
      >✎</button>
      <button
        type="button"
        class="bsm-xref-action bsm-xref-note"
        class:bsm-xref-note-filled={entry.hasBody}
        aria-label={noteTooltip(entry)}
        title={noteTooltip(entry)}
        use:icon={'file-text'}
        onclick={(event) =>
          host.openNote(entry.path, { newPane: opensInNewPane(event) })}
      ></button>
    </div>
    {#if entry.summary !== null}
      <div class="bsm-xref-summary">{entry.summary}</div>
    {/if}
    <div class="bsm-xref-members">
      {#each entry.members as member (member.index)}
        <button
          type="button"
          class="bsm-xref-member"
          onclick={(event) =>
            host.openReference(member.reference, {
              newPane: opensInNewPane(event),
            })}
        >{member.label}</button>
      {/each}
    </div>
  </div>
{/each}

<style>
  /* Item-level divider: deliberately subordinate to the section labels, which
     alone delimit the sections. */
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
