<!--
The Word Study Panel: one main-area tab dedicated to a single extended
Strong's number. It leads with the number, lemma, transliteration and the rest
of its Strong's Family, then the brief lexicon entry and the Strong's 1890
etymology. Every number on the page is walkable — plain activation retargets
this panel, a modified one spawns another. The family's concordance lands
beside these later.
-->
<script lang="ts">
  import { activate, opensInNewPane } from '../ui'
  import type { WordStudyModel } from './word-study-model'

  let { model }: { model: WordStudyModel } = $props()

  const walk = (strongsNumber: string, event: MouseEvent | KeyboardEvent): void =>
    void model.open(strongsNumber, { newPane: opensInNewPane(event) })

  // Initial snapshot only — the model subscription below keeps it fresh.
  // svelte-ignore state_referenced_locally
  let view = $state.raw(model.view)
  $effect(() =>
    model.subscribe(() => {
      view = model.view
    }),
  )
</script>

<div class="bsw-panel">
  {#if view.status === 'empty'}
    <div class="bsw-empty">
      Open a Strong's entry from the Study Panel to study its word.
    </div>
  {:else if view.status === 'loading'}
    <div class="bsw-empty">Loading…</div>
  {:else if view.install !== null}
    <div class="bsw-empty">
      Word studies read the Strong's Dictionaries, which are not installed.
    </div>
    <button
      type="button"
      class="bsw-install mod-cta"
      disabled={view.install.busy}
      onclick={() => void model.installDictionary()}
    >
      {view.install.busy
        ? "Installing Strong's Dictionaries…"
        : "Install Strong's Dictionaries"}
    </button>
    {#if view.install.error !== null}
      <div class="bsw-install-error">Install failed: {view.install.error}</div>
    {/if}
  {:else if view.entry === null}
    <div class="bsw-head">
      <span class="bsw-number">{view.number}</span>
    </div>
    <div class="bsw-empty">
      The Strong's Dictionaries carry no entry for {view.number}.
    </div>
  {:else}
    <div class="bsw-head">
      <span class="bsw-number">{view.entry.variant}</span>
      <span class="bsw-lemma">{view.entry.lemma}</span>
      <span class="bsw-translit">{view.entry.transliteration}</span>
    </div>
    {#if view.siblings.length > 0}
      <div class="bsw-siblings">
        <span class="bsw-siblings-label">Also in {view.entry.strongs}:</span>
        {#each view.siblings as sibling (sibling)}
          <span
            role="button"
            tabindex="0"
            class="bsw-link"
            title="Open word study"
            onclick={(event) => walk(sibling, event)}
            onkeydown={activate((event) => walk(sibling, event))}>{sibling}</span
          >
        {/each}
      </div>
    {/if}
    <div class="bsw-gloss">{view.entry.gloss}</div>
    {#if view.entry.morphology !== ''}
      <div class="bsw-morphology">{view.entry.morphology}</div>
    {/if}
    <div class="bsw-definition">{view.entry.definition}</div>
    {#if view.etymology !== null}
      <div class="bsw-section-heading">Etymology</div>
      <div class="bsw-etymology">
        {#each view.etymology as segment, index (index)}
          {#if segment.number === null}{segment.text}{:else}<span
              role="button"
              tabindex="0"
              class="bsw-link"
              title="Open word study"
              onclick={(event) => walk(segment.number ?? '', event)}
              onkeydown={activate((event) => walk(segment.number ?? '', event))}
              >{segment.text}</span
            >{/if}
        {/each}
      </div>
    {/if}
    {#if view.attribution !== null}
      <div class="bsw-attribution">{view.attribution}</div>
    {/if}
    {#if view.etymologyAttribution !== null}
      <div class="bsw-attribution">{view.etymologyAttribution}</div>
    {/if}
  {/if}
</div>

<style>
  .bsw-panel {
    padding: 16px 20px 40px;
    overflow-y: auto;
    height: 100%;
    user-select: text;
  }

  .bsw-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }

  .bsw-number {
    color: var(--text-accent);
    font-weight: 600;
    font-size: var(--font-ui-small);
  }

  .bsw-lemma {
    font-size: var(--font-ui-large);
  }

  .bsw-translit {
    color: var(--text-muted);
    font-style: italic;
  }

  .bsw-siblings {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 6px;
    font-size: var(--font-ui-small);
  }

  .bsw-siblings-label {
    color: var(--text-faint);
  }

  .bsw-link {
    color: var(--text-accent);
    cursor: pointer;
  }

  .bsw-link:hover {
    text-decoration: underline;
  }

  .bsw-gloss {
    font-weight: 600;
    margin-top: 10px;
  }

  .bsw-morphology {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    margin-top: 2px;
  }

  .bsw-section-heading {
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    font-weight: 600;
    margin-top: 18px;
  }

  .bsw-etymology {
    margin-top: 4px;
    color: var(--text-muted);
    line-height: var(--line-height-normal);
  }

  .bsw-definition {
    margin-top: 10px;
    color: var(--text-muted);
    white-space: pre-line;
    line-height: var(--line-height-normal);
  }

  .bsw-attribution {
    color: var(--text-faint);
    font-size: var(--font-smallest);
    margin-top: 16px;
  }

  .bsw-empty {
    color: var(--text-faint);
    font-size: var(--font-ui-small);
    margin: 6px 0;
  }

  .bsw-install {
    margin-top: 8px;
  }

  .bsw-install-error {
    color: var(--text-error);
    font-size: var(--font-ui-smaller);
    margin-top: 6px;
  }
</style>
