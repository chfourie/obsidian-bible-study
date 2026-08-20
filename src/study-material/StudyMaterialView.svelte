<!--
One reader tab's study material as a single scroll: the selected verse's
details while a verse is selected, then the chapter-scoped material — the
annotations, mentions and cross-references of the chapter on screen.
Rendered by the Study Panel following that tab.
-->
<script lang="ts">
  import type { StudyMaterial, StudyMaterialSource } from '../contracts'
  import ChapterAnnotationList from './ChapterAnnotationList.svelte'
  import ChapterMentionList from './ChapterMentionList.svelte'
  import CrossReferenceList from './CrossReferenceList.svelte'
  import type { StudyMaterialHost } from './study-material-host'
  import VerseDetails from './VerseDetails.svelte'

  let {
    material,
    source,
    host,
  }: {
    material: StudyMaterial
    source: StudyMaterialSource
    host: StudyMaterialHost
  } = $props()
</script>

<div class="bsm-view">
  {#if material.selectedVerseId !== null}
    {#if material.details === null}
      <div class="bsm-empty">Loading…</div>
    {:else}
      <VerseDetails details={material.details} {source} />
    {/if}
  {/if}
  <ChapterAnnotationList
    items={material.chapterAnnotations}
    {source}
    {host}
  />
  <ChapterMentionList items={material.chapterMentions} {host} />
  <CrossReferenceList
    entries={material.chapterCrossReferences}
    {source}
    {host}
    collecting={material.collection !== null}
  />
</div>

<style>
  .bsm-view {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 10px 12px 40px;
  }

  .bsm-empty {
    color: var(--text-faint);
    font-size: var(--font-ui-small);
    margin: 6px 0;
  }

  /* Without a verse selected the annotations lead the scroll, so their
     heading needs no lead-in. */
  .bsm-view > :global(.bsm-section-head:first-child) {
    margin-top: 0;
  }
</style>
