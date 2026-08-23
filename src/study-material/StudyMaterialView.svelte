<!--
One reader tab's study material under two tabs: Chapter carries the
chapter-scoped material — the annotations, mentions, cross-references and
Word Cloud of the chapter on screen — and Selection carries the selection's verse
details. Rendered by the Study Panel following that tab.

A book has exactly one layer, so it drops the tab bar outright and shows the
selected paragraph's details above its section material (spec-books §5).
-->
<script lang="ts">
  import type { StudyMaterial, StudyMaterialSource } from '../contracts'
  import ChapterAnnotationList from './ChapterAnnotationList.svelte'
  import ChapterMentionList from './ChapterMentionList.svelte'
  import CrossReferenceList from './CrossReferenceList.svelte'
  import type { StudyMaterialHost, StudySubTab } from './study-material-host'
  import VerseDetails from './VerseDetails.svelte'
  import WordCloud from './WordCloud.svelte'

  let {
    material,
    source,
    host,
    tab,
    selectTab,
    collapsedTranslations,
    toggleTranslation,
    collapseAllTranslations,
    expandAllTranslations,
  }: {
    material: StudyMaterial
    source: StudyMaterialSource
    host: StudyMaterialHost
    // The sub-tab belongs to the tab being surfaced, so the surface owns it.
    tab: StudySubTab
    selectTab: (tab: StudySubTab) => void
    collapsedTranslations: ReadonlySet<string>
    toggleTranslation: (id: string) => void
    collapseAllTranslations: () => void
    expandAllTranslations: () => void
  } = $props()
</script>

{#snippet sectionMaterial()}
  <ChapterAnnotationList
    items={material.chapterAnnotations}
    {host}
    annotate={() => host.promptAnnotate(source.chapterAnnotationReference())}
  />
  <ChapterMentionList items={material.chapterMentions} {host} />
  <CrossReferenceList
    entries={material.chapterCrossReferences}
    {source}
    {host}
    collecting={material.collection !== null}
  />
  <WordCloud
    cloud={material.wordCloud}
    activate={(word, event) => host.openCloudWordMenu(word, source, event)}
  />
{/snippet}

<div class="bsm-view">
  {#if !material.bookMode}
    <div class="bsm-tabs">
      <button
        type="button"
        class="bsm-tab"
        class:bsm-on={tab === 'chapter'}
        onclick={() => selectTab('chapter')}
      >Chapter</button>
      <button
        type="button"
        class="bsm-tab"
        class:bsm-on={tab === 'selection'}
        onclick={() => selectTab('selection')}
      >Selection</button>
    </div>
  {/if}
  <div class="bsm-body">
    {#if material.bookMode}
      {#if material.details !== null}
        <VerseDetails
          details={material.details}
          {source}
          {host}
          collapsed={collapsedTranslations}
          toggle={toggleTranslation}
          collapseAll={collapseAllTranslations}
          expandAll={expandAllTranslations}
        />
      {/if}
      {@render sectionMaterial()}
    {:else if tab === 'chapter'}
      {@render sectionMaterial()}
    {:else if material.selectedVerseId === null}
      <div class="bsm-empty">Select a verse to see its details.</div>
    {:else if material.details === null}
      <div class="bsm-empty">Loading…</div>
    {:else}
      <VerseDetails
        details={material.details}
        {source}
        {host}
        collapsed={collapsedTranslations}
        toggle={toggleTranslation}
        collapseAll={collapseAllTranslations}
        expandAll={expandAllTranslations}
      />
    {/if}
  </div>
</div>

<style>
  .bsm-view {
    display: flex;
    flex-direction: column;
    flex: 1;
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

  /* The first section sits right under the tab bar, so its heading needs no
     lead-in. */
  .bsm-body > :global(.bsm-section-head:first-child) {
    margin-top: 0;
  }
</style>
