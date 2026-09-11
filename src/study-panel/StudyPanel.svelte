<!--
Side-panel following the last-focused tab. For a reader tab it mirrors that
tab's study material; for a note it lists every scripture the note references,
with the passage text inline — headings fold their passage, and the book icon
opens the reference in the reader with the entry's translation.
-->
<script lang="ts">
  import type { NavigationOptions } from '../contracts'
  import type { CrossReferenceView } from '../cross-references'
  import type { Reference } from '../reference'
  import { PASSAGE_ELLIPSIS, type VerseSegment } from '../rendering'
  import ChapterAnnotationList from '../study-material/ChapterAnnotationList.svelte'
  import ChapterMentionList from '../study-material/ChapterMentionList.svelte'
  import CrossReferenceRow from '../study-material/CrossReferenceRow.svelte'
  import StudyMaterialView from '../study-material/StudyMaterialView.svelte'
  import type { AnnotationFolds, StudyMaterialHost } from '../study-material'
  import { FoldAllPair, FoldRow, activate, icon, opensInNewPane } from '../ui'
  import type {
    ReferenceEntryView,
    StudyPanelModel,
  } from './study-panel-model'

  let {
    model,
    openReference,
    host,
  }: {
    model: StudyPanelModel
    openReference: (
      reference: Reference,
      translationId: string | null,
      options?: NavigationOptions,
    ) => void
    host: StudyMaterialHost
  } = $props()

  // Initial snapshot only — the model subscription below keeps it fresh.
  // svelte-ignore state_referenced_locally
  let view = $state.raw(model.view)
  $effect(() =>
    model.subscribe(() => {
      view = model.view
    }),
  )

  const annotationFolds: AnnotationFolds = $derived({
    folded: view.foldedAnnotations,
    toggle: (file) => model.toggleAnnotationFold(file),
    foldAll: () => model.foldAllAnnotations(),
    expandAll: () => model.expandAllAnnotations(),
  })

  function open(entry: ReferenceEntryView, event: MouseEvent | KeyboardEvent) {
    openReference(entry.reference, entry.translation, {
      newPane: opensInNewPane(event),
    })
  }

  const editCrossReference = (
    entry: CrossReferenceView,
    event: MouseEvent,
  ): void => {
    model.editCrossReference(entry.path, { newPane: opensInNewPane(event) })
  }
</script>

<!-- Supplied words and Editorial marks paint here as everywhere else
     (spec-books §10); the panel's passages otherwise stay plain text. -->
{#snippet markedText(segment: VerseSegment)}{#if segment.supplied || segment.marks || segment.emended}<span
      class:scripture-study-supplied={segment.supplied}
      class:scripture-study-marks={segment.marks}
      class:scripture-study-emended={segment.emended}
    >{segment.text}</span>{:else}{segment.text}{/if}{/snippet}

{#snippet panelTitle(title: string | null)}
  <div class="bsp-title" title={title ?? ''}>
    <span class="bsp-title-text">{title}</span>
  </div>
{/snippet}

{#if view.studyMaterial !== null && model.studySource !== null}
  {@const material = view.studyMaterial}
  <div class="bsp-reader">
    {@render panelTitle(view.title)}
    <!-- Collecting a cross-reference is the reader's own work: its strip is
         where the verses being collected are, so the panel leaves it there. -->
    <StudyMaterialView
      {material}
      source={model.studySource}
      {host}
      tab={view.subTab}
      selectTab={(tab) => model.selectSubTab(tab)}
      {annotationFolds}
      collapsedTranslations={view.collapsedTranslations}
      toggleTranslation={(id) => model.toggleTranslationFold(id)}
      collapseAllTranslations={() => model.collapseAllTranslations()}
      expandAllTranslations={() => model.expandAllTranslations()}
    />
  </div>
{:else}
  <div class="bsp-panel">
    {#if view.title !== null}
      {@render panelTitle(view.title)}
    {/if}
    <div class="bsp-body">
    {#if view.status === 'no-note'}
      <p class="bsp-empty">Open a note to see its scripture references.</p>
    {:else if view.status === 'no-references'}
      <p class="bsp-empty">No scripture references in this note.</p>
    {:else}
      {#if view.status === 'no-translation'}
        <p class="bsp-empty">No translation installed.</p>
      {/if}
      <!-- The annotations and mentions intersecting the note's references,
           displayed exactly as the reader-tab sections show them. Both are
           derived here, so neither offers an add action and each hides
           itself when empty. -->
      <ChapterAnnotationList
        items={view.annotations}
        {host}
        folds={annotationFolds}
      />
      <ChapterMentionList items={view.mentions} {host} />
      {#if view.crossReferences.length > 0}
        <div class="bsp-xrefs">
          <div class="bsp-group-label">Cross-references</div>
          {#each view.crossReferences as entry, index (entry.path)}
            <CrossReferenceRow
              {entry}
              divided={index > 0}
              edit={editCrossReference}
              openNote={host.openNote}
              openReference={host.openReference}
            />
          {/each}
        </div>
      {/if}
      {#if view.entries.length > 0}
        <div class="bsp-entries-head">
          <div class="bsp-group-label">References</div>
          <FoldAllPair
            onFoldAll={() => model.foldAll()}
            onExpandAll={() => model.expandAll()}
          />
        </div>
      {/if}
      <div class="bsp-entries">
        {#each view.entries as entry (entry.key)}
          <FoldRow
            open={!view.folded.has(entry.key)}
            label={entry.label}
            subtitle={entry.translationLabel}
            toggle={() => model.toggleFold(entry.key)}
          >
            {#snippet trailing()}
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
            {/snippet}
            {#snippet body()}
              {#if entry.status === 'loading'}
                <p class="bsp-entry-state">Loading…</p>
              {:else if entry.status === 'unavailable'}
                {#if view.status !== 'no-translation'}
                  <p class="bsp-entry-state">Unavailable offline</p>
                {/if}
              {:else if entry.status === 'too-long'}
                <p class="bsp-entry-state">Reference too long to display</p>
              {:else}
                <div class="bsp-verses">
                  {#each entry.lines as line, index (index)}
                    <p class="bsp-verse">
                      {#if line.kind === 'ellipsis'}<span
                          class="bsp-verse-gap">{PASSAGE_ELLIPSIS}</span
                        >{:else}{#if line.verse.label !== null}
                          <span class="bsp-verse-number">{line.verse.label}</span>
                        {/if}{#each line.verse.segments as segment, part (part)}{@render markedText(segment)}{/each}{/if}
                    </p>
                  {/each}
                </div>
                {#if entry.attribution !== null}
                  <p class="bsp-attribution">{entry.attribution}</p>
                {/if}
              {/if}
            {/snippet}
          </FoldRow>
        {/each}
      </div>
    {/if}
    </div>
  </div>
{/if}

<style>
  .bsp-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    height: 100%;
    min-height: 0;
  }

  /* The body scrolls on its own so the title above it stays put without
     having to paint over anything. */
  .bsp-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-bottom: 0.25rem;
  }

  /* The mirrored reader fills the sidebar: each sub-tab's material scrolls
     on its own under the title and tab bar. */
  .bsp-reader {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  /* Heads the panel like a note's file header, off the same variables the
     theme styles that header with — the header's own classes can't be
     reused, as themes hang leaf-level behavior (autohiding, scroll
     transforms) off them. Centering and the accent color are the panel's
     own deliberate departures from a note header. */
  .bsp-title {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    padding: var(--size-4-1) 0 var(--size-4-2);
    font-size: var(--font-ui-medium);
    font-weight: 600;
    color: var(--text-accent);
  }

  /* One line, however long the note's name: the header keeps the height the
     theme gives a file header. */
  .bsp-title-text {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .bsp-empty {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }

  /* The entries are headed like the cross-references above them, with the
     fold controls for those entries out at the far edge of the same line. */
  .bsp-entries-head {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .bsp-entries-head .bsp-group-label {
    margin-right: auto;
  }

  .bsp-entries {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* No gap of its own: the blocks and their dividers carry the same spacing
     the reader gives its cross-references. */
  .bsp-xrefs {
    display: flex;
    flex-direction: column;
  }

  .bsp-group-label {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    font-weight: 600;
    text-transform: uppercase;
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

  /* The Verse Gap ellipsis (CONTEXT.md — Verse Gap): muted, on its own line
     and without a verse number, as it is in a block passage. */
  .bsp-verse-gap {
    color: var(--text-faint);
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
