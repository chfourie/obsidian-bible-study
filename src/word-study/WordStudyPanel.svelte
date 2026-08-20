<!--
The Word Study Panel: one main-area tab dedicated to a single extended
Strong's number. It leads with the number, lemma, transliteration and gloss,
then the brief definition the Strong's Dictionaries carry. Later sections —
etymology, siblings, the family's concordance — land beside these.
-->
<script lang="ts">
  import type { WordStudyModel } from './word-study-model'

  let { model }: { model: WordStudyModel } = $props()

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
      <span class="bsw-number">{view.entry.strongs}</span>
      <span class="bsw-lemma">{view.entry.lemma}</span>
      <span class="bsw-translit">{view.entry.transliteration}</span>
    </div>
    <div class="bsw-gloss">{view.entry.gloss}</div>
    <div class="bsw-definition">{view.entry.definition}</div>
    {#if view.attribution !== null}
      <div class="bsw-attribution">{view.attribution}</div>
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

  .bsw-gloss {
    font-weight: 600;
    margin-top: 4px;
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
