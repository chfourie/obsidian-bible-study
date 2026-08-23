<!--
The chapter's Word Cloud: its ten most tagged Strong's Families, gloss over
transliteration, each sized by how often the chapter tags it and laid out in
the order they first appear. Hovering a word shows its original-script lemma
and its count; pressing one toggles its Occurrence Emphasis in the reader. A
fallback source — a tagged translation standing in for the untagged one being
read — is named beside the heading. Without Strong's the section holds the
hint to enable it; it is hidden while there is no cloud or nothing eligible in
it.
-->
<script lang="ts">
  import type { WordCloudSourceView, WordCloudView } from '../contracts'
  import { pressable } from '../ui'
  import { cloudFontEm } from '../word-cloud'
  import SectionHeading from './SectionHeading.svelte'

  let {
    cloud,
    toggle,
  }: { cloud: WordCloudView | null; toggle: (family: string) => void } =
    $props()

  const counts = $derived(cloud?.words.map((word) => word.count) ?? [])
  const smallest = $derived(Math.min(...counts))
  const largest = $derived(Math.max(...counts))

  const heading = (source: WordCloudSourceView): string =>
    source.fallback ? `Word Cloud · ${source.label}` : 'Word Cloud'

  const tooltip = (lemma: string, count: number): string =>
    lemma === '' ? `${count}` : `${lemma} · ${count}`
</script>

{#if cloud?.source === null}
  <SectionHeading label="Word Cloud" />
  <div class="bsm-cloud-hint">Enable Strong's to see the word cloud.</div>
{:else if cloud !== null && cloud.words.length > 0}
  <SectionHeading label={heading(cloud.source)} />
  <div class="bsm-word-cloud">
    {#each cloud.words as word (word.family)}
      <span
        class="bsm-cloud-word"
        class:bsm-cloud-word-active={word.active}
        style:font-size="{cloudFontEm(word.count, smallest, largest)}em"
        title={tooltip(word.lemma, word.count)}
        role="button"
        tabindex="0"
        aria-pressed={word.active}
        use:pressable={() => toggle(word.family)}
      >
        <span class="bsm-cloud-gloss">{word.gloss}</span>
        {#if word.transliteration !== ''}
          <span class="bsm-cloud-translit">{word.transliteration}</span>
        {/if}
      </span>
    {/each}
  </div>
{/if}

<style>
  .bsm-cloud-hint {
    color: var(--text-faint);
    font-size: var(--font-ui-small);
    margin: 6px 0;
  }

  .bsm-word-cloud {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 6px;
    margin: 8px 0 4px;
    font-size: var(--font-ui-small);
  }

  .bsm-cloud-word {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    padding: 0.15em 0.45em;
    border-radius: var(--radius-s);
    background: var(--background-secondary);
    color: var(--text-normal);
    line-height: 1.15;
    cursor: pointer;
  }

  .bsm-cloud-word:hover {
    background: var(--background-modifier-hover);
  }

  .bsm-cloud-word:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 1px;
  }

  /* The accent pair reads distinctly against the panel in both themes. */
  .bsm-cloud-word-active,
  .bsm-cloud-word-active:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .bsm-cloud-translit {
    font-size: 0.6em;
    color: var(--text-muted);
    font-style: italic;
  }

  .bsm-cloud-word-active .bsm-cloud-translit {
    color: inherit;
  }
</style>
