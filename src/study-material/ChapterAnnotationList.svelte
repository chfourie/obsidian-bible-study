<!--
The annotations intersecting the scripture in view, one folded row each:
the chevron and the reference heading both toggle the row, and an open row
renders the note's whole body beneath in the panel's own scroll. Which rows
stand open is the followed tab's memory, handed in as `folds`. The reader's
chapter section carries an add action opening the annotation prompt
prefilled from its selection; a surface passing no add action — the note-tab
panel — gets a bare heading instead, and the whole section hides itself when
empty.
-->
<script lang="ts">
  import type { ChapterAnnotationView } from '../contracts'
  import { activate, icon } from '../ui'
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
  />
{/if}
{#if items.length === 0}
  {#if annotate !== null}
    <div class="bsm-chapter-anno-empty">No annotations for this chapter.</div>
  {/if}
{:else}
  {#each items as item, index (item.file)}
    {@const open = !folds.folded.has(item.file)}
    {#if index > 0}<hr class="bsm-chapter-anno-sep" />{/if}
    <section class="bsm-chapter-anno-block">
      <button
        type="button"
        class="bsm-chapter-anno-open"
        aria-label="Open annotation in editor"
        onclick={() => host.openNote(item.file)}
      >✎</button>
      <span
        role="button"
        tabindex="0"
        class="bsm-chapter-anno-ref"
        aria-expanded={open}
        onclick={() => folds.toggle(item.file)}
        onkeydown={activate(() => folds.toggle(item.file))}
      >
        <span
          class="bsm-chapter-anno-fold-icon"
          aria-hidden="true"
          use:icon={open ? 'chevron-down' : 'chevron-right'}
        ></span>
        {item.label}
      </span>
      {#if open}
        <div
          class="bsm-chapter-anno-body"
          use:markdown={{ text: item.body, path: item.file }}
        ></div>
      {/if}
    </section>
  {/each}
{/if}

<style>
  .bsm-chapter-anno-empty {
    color: var(--text-faint);
    font-size: var(--font-ui-small);
    margin: 6px 0;
  }

  /* Item-level divider: deliberately subordinate to the section labels, which
     alone delimit the sections. */
  .bsm-chapter-anno-sep {
    width: 2.5rem;
    margin: 8px 0;
    border: none;
    border-top: 1px solid var(--background-modifier-border);
  }

  /* The whole block is one hover target: anywhere over the reference or the
     body reveals the single open action anchored to the block. */
  .bsm-chapter-anno-block {
    position: relative;
    margin: 4px -4px 8px;
    padding: 2px 24px 2px 4px;
    border-radius: 4px;
    font-size: var(--font-ui-small);
  }

  .bsm-chapter-anno-block:hover {
    background: var(--background-modifier-hover);
  }

  .bsm-chapter-anno-ref {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    color: var(--text-accent);
    font-weight: 600;
    cursor: pointer;
  }

  .bsm-chapter-anno-fold-icon {
    display: inline-flex;
    align-items: center;
    color: var(--text-muted);
  }

  .bsm-chapter-anno-fold-icon :global(svg) {
    width: var(--icon-xs);
    height: var(--icon-xs);
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

  .bsm-chapter-anno-block:hover .bsm-chapter-anno-open,
  .bsm-chapter-anno-open:focus-visible {
    opacity: 1;
  }

  .bsm-chapter-anno-open:hover {
    color: var(--text-accent);
  }
</style>
