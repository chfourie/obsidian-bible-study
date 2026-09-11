<!--
The annotations intersecting the scripture in view, one folded row each in
the Study Panel's row grammar: the chevron and the reference heading both
toggle the row, the note's own name stands muted beside the address so two
annotations on one address are told apart, and an open row renders the
note's whole body beneath in the panel's own scroll. The pencil opening the
note stands in the trailing slot, shown while the row's head is hovered or
the pencil focused, taking a new pane with the modifier. Which rows stand open is the followed tab's memory, handed in as
`folds`, which the heading's fold-all pair acts on whole once there is a row
to fold. The reader's chapter section carries an add action opening the
annotation prompt prefilled from its selection; a surface passing no add
action — the note-tab panel — gets a bare heading instead, and the whole
section hides itself when empty.
-->
<script lang="ts">
  import type { ChapterAnnotationView } from '../contracts'
  import { FoldRow, opensInNewPane } from '../ui'
  import type { AnnotationFolds } from './annotation-folds'
  import SectionHeading from './SectionHeading.svelte'
  import type { StudyMaterialHost } from './study-material-host'

  let {
    items,
    host,
    folds,
    annotate = null,
  }: {
    items: ChapterAnnotationView[]
    host: StudyMaterialHost
    folds: AnnotationFolds
    annotate?: (() => void) | null
  } = $props()

  type MarkdownBody = { text: string; path: string }
  const markdown = (el: HTMLElement, body: MarkdownBody) => {
    const render = (value: MarkdownBody): void => {
      el.replaceChildren()
      host.renderMarkdown(el, value.text, value.path)
    }
    render(body)
    return { update: render }
  }
</script>

{#if annotate !== null || items.length > 0}
  <SectionHeading
    label="Annotations"
    action="Annotate the selection or chapter"
    onAdd={annotate}
    onFoldAll={items.length > 0 ? folds.foldAll : null}
    onExpandAll={items.length > 0 ? folds.expandAll : null}
  />
{/if}
{#if items.length === 0}
  {#if annotate !== null}
    <div class="bsm-chapter-anno-empty">No annotations for this chapter.</div>
  {/if}
{:else}
  <div class="bsm-chapter-anno-list">
    {#each items as item (item.file)}
      <FoldRow
        open={!folds.folded.has(item.file)}
        label={item.label}
        subtitle={item.title}
        toggle={() => folds.toggle(item.file)}
      >
        {#snippet trailing()}
          <button
            type="button"
            class="bsm-chapter-anno-open"
            aria-label="Open annotation in editor"
            title="Open annotation in editor"
            onclick={(event) =>
              host.openNote(item.file, { newPane: opensInNewPane(event) })}
          >✎</button>
        {/snippet}
        {#snippet body()}
          <div
            class="bsm-chapter-anno-body"
            use:markdown={{ text: item.body, path: item.file }}
          ></div>
        {/snippet}
      </FoldRow>
    {/each}
  </div>
{/if}

<style>
  .bsm-chapter-anno-empty {
    color: var(--text-faint);
    font-size: var(--font-ui-small);
    margin: 6px 0;
  }

  /* The rows of annotations keep the rhythm the referenced passages keep:
     one gap between rows, no rule between them, in the UI's small type. */
  .bsm-chapter-anno-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    font-size: var(--font-ui-small);
  }

  /* Rendered markdown brings its own paragraph margins; trimming the outer
     ones keeps the block compact under its reference heading. */
  .bsm-chapter-anno-body :global(> :first-child) {
    margin-top: 0;
  }

  .bsm-chapter-anno-body :global(> :last-child) {
    margin-bottom: 0;
  }

  /* The whole body, in the panel's own scroll: never a box scrolling inside
     a scrolling panel. */
  .bsm-chapter-anno-body {
    user-select: text;
  }

  .bsm-chapter-anno-open {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    background: none;
    border: none;
    box-shadow: none;
    width: auto;
    height: auto;
    min-height: 0;
    padding: 2px;
    border-radius: var(--radius-s);
    line-height: 1;
    color: var(--text-muted);
    cursor: pointer;
    opacity: 0;
  }

  :global(.bsm-fold-row-head:hover) .bsm-chapter-anno-open,
  .bsm-chapter-anno-open:focus-visible {
    opacity: 1;
  }

  .bsm-chapter-anno-open:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }
</style>
