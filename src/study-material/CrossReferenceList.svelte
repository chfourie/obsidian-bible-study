<!--
The cross-references touching whatever the section covers — a verse or the
chapter on screen — with the action that starts collecting a new one. Each row
opens its members, or loads itself into the collect strip for editing.
-->
<script lang="ts">
  import type { StudyMaterialSource } from '../contracts'
  import type { CrossReference, CrossReferenceView } from '../cross-references'
  import { opensInNewPane } from '../ui'
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
      id: entry.id,
      members: entry.allMembers,
      description: entry.description,
    }
    if (opensInNewPane(event)) host.editCrossReferenceInNewPane(edited)
    else source.startEditingCrossReference(edited)
  }
</script>

<SectionHeading
  label="Cross-references"
  action="Collect a cross-reference"
  onAdd={() => source.startCollecting()}
  disabled={collecting}
/>
{#each entries as entry, index (entry.id)}
  {#if index > 0}<hr class="bsm-xref-sep" />{/if}
  <div class="bsm-xref-block">
    <button
      type="button"
      class="bsm-xref-edit"
      aria-label="Edit cross-reference in the reader"
      disabled={collecting}
      onclick={(event) => edit(entry, event)}
    >✎</button>
    {#if entry.description !== null}
      <div class="bsm-xref-description">{entry.description}</div>
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

  /* The whole block is one hover target: anywhere over the description or its
     members reveals the single edit icon anchored to the block. */
  .bsm-xref-block {
    position: relative;
    margin: 2px -4px;
    padding: 2px 24px 2px 4px;
    border-radius: 4px;
    font-size: var(--font-ui-small);
  }

  .bsm-xref-block:hover {
    background: var(--background-modifier-hover);
  }

  .bsm-xref-description {
    color: var(--text-muted);
  }

  .bsm-xref-edit {
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

  .bsm-xref-block:hover .bsm-xref-edit,
  .bsm-xref-edit:focus-visible {
    opacity: 1;
  }

  .bsm-xref-edit:hover:not(:disabled) {
    color: var(--text-accent);
  }

  .bsm-xref-edit:disabled {
    color: var(--text-faint);
    cursor: default;
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
