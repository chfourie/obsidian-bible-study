<!--
One reader tab's study material as a region: the selected verse's details
under Translations/Notes sub-tabs, and the chapter-scoped material — the
annotations, mentions and cross-references of the chapter on screen — below
them.
Rendered by the Study Panel following that tab.
-->
<script lang="ts">
  import type { StudyMaterial, StudyMaterialSource } from '../contracts'
  import ChapterAnnotationList from './ChapterAnnotationList.svelte'
  import ChapterMentionList from './ChapterMentionList.svelte'
  import CrossReferenceList from './CrossReferenceList.svelte'
  import type { StudyMaterialHost, StudySubTab } from './study-material-host'
  import VerseDetails from './VerseDetails.svelte'

  let {
    material,
    source,
    host,
    tab,
    selectTab,
  }: {
    material: StudyMaterial
    source: StudyMaterialSource
    host: StudyMaterialHost
    // The sub-tab belongs to the tab being surfaced, so the surface owns it.
    tab: StudySubTab
    selectTab: (tab: StudySubTab) => void
  } = $props()
</script>

<div class="bsm-view">
  <div class="bsm-tabs">
    <button
      type="button"
      class="bsm-tab"
      class:bsm-on={tab === 'translations'}
      onclick={() => selectTab('translations')}
    >Translations</button>
    <button
      type="button"
      class="bsm-tab"
      class:bsm-on={tab === 'notes'}
      onclick={() => selectTab('notes')}
    >Notes</button>
  </div>
  <div class="bsm-body">
    {#if material.selectedVerseId === null}
      <div class="bsm-empty">Select a verse to see details.</div>
    {:else if material.details === null}
      <div class="bsm-empty">Loading…</div>
    {:else}
      <VerseDetails details={material.details} {source} {host} {tab} />
    {/if}
  </div>
  <div class="bsm-chapter">
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
</div>

<style>
  .bsm-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    height: 100%;
    min-height: 0;
  }

  .bsm-tabs {
    display: flex;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .bsm-tab {
    flex: 1;
    background: none;
    border: none;
    border-radius: 0;
    box-shadow: none;
    padding: 8px;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    border-bottom: 2px solid transparent;
    cursor: pointer;
  }

  .bsm-tab.bsm-on {
    color: var(--text-accent);
    border-bottom-color: var(--text-accent);
  }

  .bsm-body {
    flex: 1;
    overflow-y: auto;
    padding: 10px 12px 40px;
  }

  .bsm-empty {
    color: var(--text-faint);
    font-size: var(--font-ui-small);
    margin: 6px 0;
  }

  /* Chapter-scoped, so it sits apart from the selected verse's details above
     and takes only the height its rows need, up to its own scroll. */
  .bsm-chapter {
    flex: 0 0 auto;
    max-height: 40%;
    overflow-y: auto;
    border-top: 1px solid var(--background-modifier-border);
    padding: 4px 12px 10px;
  }

  /* The first section already sits under the region's border, so it needs no
     lead-in; the sections below keep theirs. */
  .bsm-chapter > :global(.bsm-section-head:first-child) {
    margin-top: 0;
  }
</style>
