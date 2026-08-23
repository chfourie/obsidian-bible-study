<!--
The chapter's Word Cloud: its ten most tagged Strong's Families, gloss over
transliteration, each sized by how often the chapter tags it and laid out in
the order they first appear. Hovering a word shows its original-script lemma
and its count. Hidden while there is no cloud or nothing eligible in it.
-->
<script lang="ts">
  import type { WordCloudView } from '../contracts'
  import { cloudFontEm } from '../word-cloud'
  import SectionHeading from './SectionHeading.svelte'

  let { cloud }: { cloud: WordCloudView | null } = $props()

  const counts = $derived(cloud?.words.map((word) => word.count) ?? [])
  const smallest = $derived(Math.min(...counts))
  const largest = $derived(Math.max(...counts))

  const tooltip = (lemma: string, count: number): string =>
    lemma === '' ? `${count}` : `${lemma} · ${count}`
</script>

{#if cloud !== null && cloud.words.length > 0}
  <SectionHeading label="Word Cloud" />
  <div class="bsm-word-cloud">
    {#each cloud.words as word (word.family)}
      <span
        class="bsm-cloud-word"
        class:bsm-cloud-word-active={word.active}
        style:font-size="{cloudFontEm(word.count, smallest, largest)}em"
        title={tooltip(word.lemma, word.count)}
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
    cursor: default;
  }

  .bsm-cloud-word:hover {
    background: var(--background-modifier-hover);
  }

  .bsm-cloud-word-active {
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
