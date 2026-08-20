<!--
One reader tab's study material under two tabs: Study carries the
chapter-scoped material — the annotations, mentions and cross-references of
the chapter on screen — and Translations carries the selection's verse
details. Rendered by the Study Panel following that tab.
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

<div class="bsm-view">
  <div class="bsm-tabs">
    <button
      type="button"
      class="bsm-tab"
      class:bsm-on={tab === 'study'}
      onclick={() => selectTab('study')}
    >Study</button>
    <button
      type="button"
      class="bsm-tab"
      class:bsm-on={tab === 'translations'}
      onclick={() => selectTab('translations')}
    >Translations</button>
  </div>
  <div class="bsm-body">
    {#if tab === 'study'}
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
    {:else if material.selectedVerseId === null}
      <div class="bsm-empty">Select a verse to see its translations.</div>
    {:else if material.details === null}
      <div class="bsm-empty">Loading…</div>
    {:else}
      <VerseDetails
        details={material.details}
        {source}
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
