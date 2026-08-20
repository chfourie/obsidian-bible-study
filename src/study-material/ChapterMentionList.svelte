<!--
The mentions intersecting the chapter on screen: notes whose bodies reference
it without being dedicated to it. Each carries the note's title and the
in-chapter references it makes; clicking one opens the note. Mentions are
derived, so the section offers no add action and hides itself when empty.
-->
<script lang="ts">
  import type { ChapterMentionView } from '../contracts'
  import SectionHeading from './SectionHeading.svelte'
  import type { StudyMaterialHost } from './study-material-host'

  let {
    items,
    host,
  }: {
    items: ChapterMentionView[]
    host: StudyMaterialHost
  } = $props()
</script>

{#if items.length > 0}
  <SectionHeading label="Mentions" />
  <ul class="bsm-chapter-mention-list">
    {#each items as item (item.file)}
      <li class="bsm-chapter-mention-item">
        <button
          type="button"
          class="bsm-chapter-mention-link"
          onclick={() => host.openNote(item.file)}
        >{item.title}</button>
        <span class="bsm-chapter-mention-refs">{item.labels.join(', ')}</span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .bsm-chapter-mention-list {
    margin: 4px 0;
    padding-left: 1.2em;
    font-size: var(--font-ui-small);
  }

  .bsm-chapter-mention-item::marker {
    color: var(--text-faint);
  }

  .bsm-chapter-mention-link {
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
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsm-chapter-mention-link:hover {
    color: var(--text-accent);
    background: none;
    box-shadow: none;
  }

  .bsm-chapter-mention-refs {
    margin-left: 6px;
    color: var(--text-accent);
    font-size: var(--font-ui-smaller);
  }
</style>
